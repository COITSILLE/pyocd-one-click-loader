const vscode = require('vscode');
const path = require('path');
const { runInTerminal, checkPyOCD } = require('./utils');
const { pickTarget } = require('./targets');

/**
 * Find .elf files inside the workspace, preferring ./build/**.
 */
async function findElfFiles() {
  // First try inside build folders
  const buildPattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'build/**/*.elf');
  let files = await vscode.workspace.findFiles(buildPattern, null, 200);
  if (files.length === 0) {
    // Fallback: search entire workspace
    const allPattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], '**/*.elf');
    files = await vscode.workspace.findFiles(allPattern, '**/node_modules/**', 200);
  }
  return files;
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

  const config = vscode.workspace.getConfiguration('pyocd-one-click-loader');
  let target = config.get('target', '').trim();
  if (!target) {
    // If no target configured, prompt user to pick one, then continue
    const chosen = await pickTarget('');
    if (!chosen) {
      // User cancelled
      return;
    }
    await config.update('target', chosen, vscode.ConfigurationTarget.Workspace);
    target = chosen;
    vscode.window.showInformationMessage(`Target set to: ${chosen}`);
  }

  const fileUri = await pickElfFile();
  if (!fileUri) return;

  const filePath = fileUri.fsPath;
  const command = `pyocd load -t ${target} "${filePath}"`;
  runInTerminal(command);
}

module.exports = { flash, pickElfFile };