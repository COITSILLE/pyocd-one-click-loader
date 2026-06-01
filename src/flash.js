const vscode = require('vscode');
const path = require('path');
const { runInTerminal, checkPyOCD } = require('./utils');
const { pickTarget } = require('./targets');

// Cache lives for the entire session; kept up-to-date by FileSystemWatcher.
// Only invalidated when workspace folders change.
let elfCache = []; // vscode.Uri[]
let elfRefreshPromise = null;
let elfWatcherInitialized = false;
let elfWatcherSubscriptions = [];

function setElfCache(files) {
  const unique = new Map();
  for (const file of files) {
    unique.set(file.fsPath, file);
  }
  elfCache = [...unique.values()];
}

function updateElfCacheFromWatcher(uri) {
  const existing = new Map(elfCache.map(item => [item.fsPath, item]));
  existing.set(uri.fsPath, uri);
  elfCache = [...existing.values()];
}

function removeElfFromCache(uri) {
  elfCache = elfCache.filter(item => item.fsPath !== uri.fsPath);
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
    // Workspace changed: clear stale cache, will re-scan on next request.
    elfCache = [];
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

// Get user-configured search patterns (e.g. ["build", "out/Debug"]).
// Each entry is turned into "{entry}/** /*.elf" (no space).
// Returns empty array if not configured.
function getUserSearchPatterns() {
  const config = vscode.workspace.getConfiguration('pyocd-one-click-loader');
  const paths = config.get('elfSearchPaths', []);
  if (!Array.isArray(paths) || paths.length === 0) return [];
  return paths.map(p => `${p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/**/*.elf`);
}

/**
 * Find .elf files inside the workspace.
 * Cache is session-long, kept current by FileSystemWatcher.
 * Only re-scans when cache is empty (first run or workspace changed).
 */
async function findElfFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    setElfCache([]);
    return [];
  }

  ensureElfWatcher();

  // Watcher keeps cache up-to-date; return immediately if populated.
  if (elfCache.length > 0) {
    return elfCache;
  }

  // Deduplicate concurrent scans.
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

    // 1) User-configured search paths (fastest, most specific)
    const userPatterns = getUserSearchPatterns();
    if (userPatterns.length > 0) {
      const userTasks = [];
      for (const pattern of userPatterns) {
        for (const folder of workspaceFolders) {
          userTasks.push(vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), null, 200));
        }
      }
      const userResults = await Promise.all(userTasks);
      userResults.forEach(addFiles);
    }

    // 2) Common build directories
    if (uniqueFiles.size === 0) {
      const commonBuildDirs = ['build/**/*.elf', 'out/**/*.elf', 'Debug/**/*.elf', 'Release/**/*.elf', 'bin/**/*.elf'];
      const buildTasks = [];
      for (const pattern of commonBuildDirs) {
        for (const folder of workspaceFolders) {
          buildTasks.push(vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), null, 200));
        }
      }
      const buildResults = await Promise.all(buildTasks);
      buildResults.forEach(addFiles);
    }

    // 3) Full workspace scan (last resort)
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