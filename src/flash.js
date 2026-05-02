const vscode = require('vscode');
const path = require('path');
const { runInTerminal, checkPyOCD } = require('./utils');
const { pickTarget } = require('./targets');

/**
 * Find .elf files inside the workspace, preferring ./build/**.
 */
async function findElfFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    return [];
  }

  const uniqueFiles = new Map();
  const addFiles = files => {
    for (const file of files) {
      uniqueFiles.set(file.fsPath, file);
    }
  };

  const commonBuildDirs = ['build/**/*.elf', 'out/**/*.elf', 'Debug/**/*.elf', 'Release/**/*.elf', 'bin/**/*.elf'];

  // Prefer common firmware build output directories first.
  for (const pattern of commonBuildDirs) {
    for (const folder of workspaceFolders) {
      const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), null, 200);
      addFiles(files);
    }
  }

  if (uniqueFiles.size > 0) {
    return [...uniqueFiles.values()];
  }

  // Fallback: search the entire workspace for any .elf file.
  for (const folder of workspaceFolders) {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.elf'), null, 200);
    addFiles(files);
  }

  return [...uniqueFiles.values()];
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
    const relative = path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, uri.fsPath);
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

module.exports = { flash, pickElfFile };