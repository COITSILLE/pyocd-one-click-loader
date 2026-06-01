const vscode = require('vscode');
const path = require('path');
const { runInTerminal, checkPyOCD } = require('./utils');
const { pickTarget } = require('./targets');

const ELF_CACHE_TTL_MS = 10000;

let elfCache = []; // vscode.Uri[]
let elfCacheTimestamp = 0;
let elfRefreshPromise = null;
let elfWatcherInitialized = false;
let elfWatcherSubscriptions = [];

function setElfCache(files) {
  const unique = new Map();
  for (const file of files) {
    unique.set(file.fsPath, file);
  }
  elfCache = [...unique.values()];
  elfCacheTimestamp = Date.now();
}

function updateElfCacheFromWatcher(uri) {
  const existing = new Map(elfCache.map(item => [item.fsPath, item]));
  existing.set(uri.fsPath, uri);
  elfCache = [...existing.values()];
  elfCacheTimestamp = Date.now();
}

function removeElfFromCache(uri) {
  elfCache = elfCache.filter(item => item.fsPath !== uri.fsPath);
  elfCacheTimestamp = Date.now();
}

function ensureElfWatcher() {
  if (elfWatcherInitialized) return;
  elfWatcherInitialized = true;

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.elf');
  watcher.onDidCreate(updateElfCacheFromWatcher);
  watcher.onDidChange(updateElfCacheFromWatcher);
  watcher.onDidDelete(removeElfFromCache);
  elfWatcherSubscriptions.push(watcher);

  const closeWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    // Workspace changed: trigger a refresh on next request.
    elfCache = [];
    elfCacheTimestamp = 0;
  });
  elfWatcherSubscriptions.push(closeWatcher);
}

function disposeFlashResources() {
  for (const disposable of elfWatcherSubscriptions) {
    disposable.dispose();
  }
  elfWatcherSubscriptions = [];
  elfWatcherInitialized = false;
  elfRefreshPromise = null;
}

/**
 * Find .elf files inside the workspace, preferring ./build/**.
 */
async function findElfFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    setElfCache([]);
    return [];
  }

  ensureElfWatcher();

  const cacheIsFresh = elfCache.length > 0 && (Date.now() - elfCacheTimestamp) < ELF_CACHE_TTL_MS;
  if (cacheIsFresh) {
    return elfCache;
  }

  if (elfRefreshPromise) {
    return elfRefreshPromise;
  }

  elfRefreshPromise = (async () => {
    const uniqueFiles = new Map();
    const addFiles = files => {
      for (const file of files) {
        uniqueFiles.set(file.fsPath, file);
      }
    };

    const commonBuildDirs = ['build/**/*.elf', 'out/**/*.elf', 'Debug/**/*.elf', 'Release/**/*.elf', 'bin/**/*.elf'];
    const preferredSearchTasks = [];
    for (const pattern of commonBuildDirs) {
      for (const folder of workspaceFolders) {
        preferredSearchTasks.push(vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), null, 200));
      }
    }
    const preferredResults = await Promise.all(preferredSearchTasks);
    preferredResults.forEach(addFiles);

    if (uniqueFiles.size === 0) {
      const fallbackTasks = workspaceFolders.map(folder => (
        vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.elf'), null, 200)
      ));
      const fallbackResults = await Promise.all(fallbackTasks);
      fallbackResults.forEach(addFiles);
    }

    setElfCache([...uniqueFiles.values()]);
    return elfCache;
  })();

  try {
    return await elfRefreshPromise;
  } finally {
    elfRefreshPromise = null;
  }
}

/**
 * Let user pick an ELF file from the discovered list.
 * Returns the selected URI or undefined.
 */
async function pickElfFile() {
  const files = await findElfFiles();
  if (files.length === 0) {
    vscode.window.showErrorMessage('No .elf files found in the workspace. Try building first.');
    return undefined;
  }

  const items = files.map(uri => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const base = folder ? folder.uri.fsPath : vscode.workspace.workspaceFolders[0].uri.fsPath;
    const relative = path.relative(base, uri.fsPath);
    return {
      label: relative,
      description: '', // could add date but QuickPick doesn't show easily
      uri
    };
  });

  const chosen = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the firmware file to flash',
    canPickMany: false
  });
  return chosen ? chosen.uri : undefined;
}

/**
 * Perform flashing using the stored target and selected file.
 */
async function flash() {
  const ok = await checkPyOCD();
  if (!ok) {
    vscode.window.showErrorMessage('pyOCD not found. Please install it: pip install pyocd');
    return;
  }

  const fileUri = await pickElfFile();
  if (!fileUri) return;

  const config = vscode.workspace.getConfiguration('pyocd-one-click-loader', fileUri);
  let target = config.get('target', '').trim();
  const reset = config.get('resetAfterLoad', true);
  if (!target) {
    // If no target configured, prompt user to pick one, then continue
    const chosen = await pickTarget('');
    if (!chosen) {
      // User cancelled
      return;
    }
    await config.update('target', chosen, vscode.ConfigurationTarget.WorkspaceFolder);
    target = chosen;
    vscode.window.showInformationMessage(`Target set to: ${chosen}`);
  }

  const filePath = fileUri.fsPath;
  // Append --no-reset when user disabled resetAfterLoad
  const noResetFlag = reset ? '' : ' --no-reset';
  const command = `pyocd load -t ${target}${noResetFlag} "${filePath}"`;
  runInTerminal(command);
}

module.exports = { flash, pickElfFile, disposeFlashResources };