const vscode = require('vscode');
const path = require('path');
const { runInTerminal, checkPyOCD } = require('./utils');
const { pickTarget } = require('./targets');

// --- Firmware format priority (highest to lowest) ---
// Read from configuration; default: ['.elf', '.hex'] (no .bin)
function getFirmwareExtensions() {
  const config = vscode.workspace.getConfiguration('pyocd-one-click-loader');
  const exts = config.get('firmwareExtensions', ['.elf', '.hex']);
  return exts.map(e => e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`);
}

function getFirmwareGlobPattern() {
  const exts = getFirmwareExtensions();
  const extNames = exts.map(e => e.replace('.', ''));
  return `**/*.{${extNames.join(',')}}`;
}

function getFirmwarePriority(uri) {
  const exts = getFirmwareExtensions();
  const ext = path.extname(uri.fsPath).toLowerCase();
  const idx = exts.indexOf(ext);
  return idx === -1 ? exts.length : idx;
}

/**
 * Deduplicate firmware files: when multiple formats exist for the same base name
 * (e.g. firmware.elf, firmware.hex, firmware.bin), keep only the highest priority one.
 */
function deduplicateFirmwareFiles(files) {
  const groups = new Map();
  for (const uri of files) {
    const ext = path.extname(uri.fsPath).toLowerCase();
    const dir = path.dirname(uri.fsPath);
    const base = path.basename(uri.fsPath, ext);
    const key = path.join(dir, base);
    const priority = getFirmwarePriority(uri);
    const existing = groups.get(key);
    if (!existing || priority < existing.priority) {
      groups.set(key, { uri, priority });
    }
  }
  return [...groups.values()].map(item => item.uri);
}

// Cache lives for the entire session; kept up-to-date by FileSystemWatcher.
// Only invalidated when workspace folders change.
let firmwareCache = []; // vscode.Uri[]
let firmwareRefreshPromise = null;
let firmwareWatcherInitialized = false;
let firmwareWatcherSubscriptions = [];

function setFirmwareCache(files) {
  const unique = new Map();
  for (const file of files) {
    unique.set(file.fsPath, file);
  }
  firmwareCache = [...unique.values()];
}

function updateFirmwareCacheFromWatcher(uri) {
  const existing = new Map(firmwareCache.map(item => [item.fsPath, item]));
  existing.set(uri.fsPath, uri);
  firmwareCache = [...existing.values()];
}

function removeFirmwareFromCache(uri) {
  firmwareCache = firmwareCache.filter(item => item.fsPath !== uri.fsPath);
}

function ensureFirmwareWatcher() {
  if (firmwareWatcherInitialized) return;
  firmwareWatcherInitialized = true;

  const watcher = vscode.workspace.createFileSystemWatcher(getFirmwareGlobPattern());
  watcher.onDidCreate(updateFirmwareCacheFromWatcher);
  watcher.onDidChange(updateFirmwareCacheFromWatcher);
  watcher.onDidDelete(removeFirmwareFromCache);
  firmwareWatcherSubscriptions.push(watcher);

  const closeWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    // Workspace changed: clear stale cache, will re-scan on next request.
    firmwareCache = [];
  });
  firmwareWatcherSubscriptions.push(closeWatcher);
}

function disposeFlashResources() {
  for (const disposable of firmwareWatcherSubscriptions) {
    disposable.dispose();
  }
  firmwareWatcherSubscriptions = [];
  firmwareWatcherInitialized = false;
  firmwareRefreshPromise = null;
}

// Build a glob extension set like "{elf,hex}" from configured firmwareExtensions.
function buildExtGlob() {
  return `{${getFirmwareExtensions().map(e => e.replace('.', '')).join(',')}}`;
}

// Get user-configured search patterns (e.g. ["build", "out/Debug"]).
// Each entry is turned into "{entry}/**/*.{elf,hex}".
// Returns empty array if not configured.
function getUserSearchPatterns() {
  const config = vscode.workspace.getConfiguration('pyocd-one-click-loader');
  const paths = config.get('elfSearchPaths', []);
  if (!Array.isArray(paths) || paths.length === 0) return [];
  const extGlob = buildExtGlob();
  return paths.map(p => `${p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/**/*.${extGlob}`);
}

/**
 * Find firmware files (.elf, .hex, .bin) inside the workspace.
 * When multiple formats exist for the same base name, only the highest-priority
 * format (elf > hex > bin) is kept.
 * Cache is session-long, kept current by FileSystemWatcher.
 * Only re-scans when cache is empty (first run or workspace changed).
 */
async function findFirmwareFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    setFirmwareCache([]);
    return [];
  }

  ensureFirmwareWatcher();

  // Watcher keeps cache up-to-date; return immediately if populated.
  if (firmwareCache.length > 0) {
    return firmwareCache;
  }

  // Deduplicate concurrent scans.
  if (firmwareRefreshPromise) {
    return firmwareRefreshPromise;
  }

  firmwareRefreshPromise = (async () => {
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
      const extGlob = buildExtGlob();
      const commonBuildDirs = [
        `build/**/*.${extGlob}`,
        `out/**/*.${extGlob}`,
        `Debug/**/*.${extGlob}`,
        `Release/**/*.${extGlob}`,
        `bin/**/*.${extGlob}`
      ];
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
        vscode.workspace.findFiles(new vscode.RelativePattern(folder, getFirmwareGlobPattern()), null, 200)
      ));
      const fallbackResults = await Promise.all(fallbackTasks);
      fallbackResults.forEach(addFiles);
    }

    // Deduplicate: keep highest-priority format per base name
    const deduplicated = deduplicateFirmwareFiles([...uniqueFiles.values()]);
    setFirmwareCache(deduplicated);
    return firmwareCache;
  })();

  try {
    return await firmwareRefreshPromise;
  } finally {
    firmwareRefreshPromise = null;
  }
}

/**
 * Let user pick a firmware file from the discovered list.
 * Deduplicated by base name (elf > hex > bin priority).
 * Returns the selected URI or undefined.
 */
async function pickFirmwareFile() {
  const files = await findFirmwareFiles();
  if (files.length === 0) {
    const exts = getFirmwareExtensions().join('/');
    vscode.window.showErrorMessage(`No firmware files (${exts}) found in the workspace. Try building first.`);
    return undefined;
  }

  const items = files.map(uri => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const base = folder ? folder.uri.fsPath : vscode.workspace.workspaceFolders[0].uri.fsPath;
    const relative = path.relative(base, uri.fsPath);
    return {
      label: relative,
      description: '',
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

  const fileUri = await pickFirmwareFile();
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

module.exports = { flash, pickFirmwareFile, disposeFlashResources };