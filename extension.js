const vscode = require('vscode');
const { pickTarget } = require('./src/targets');
const { flash, disposeFlashResources } = require('./src/flash');
const { checkPyOCD } = require('./src/utils');

function getSettingsTarget() {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Workspace;
}

function getWorkspaceScopeUri() {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function activate(context) {
  // Register command: select target
  const selectTargetCmd = vscode.commands.registerCommand(
    'pyocd-one-click-loader.selectTarget',
    async () => {
      const ok = await checkPyOCD();
      if (!ok) {
        vscode.window.showErrorMessage('pyOCD not found. Install it with "pip install pyocd" and try again.');
        return;
      }

      const config = vscode.workspace.getConfiguration('pyocd-one-click-loader', getWorkspaceScopeUri());
      const current = config.get('target', '');

      const chosen = await pickTarget(current);
      if (chosen) {
        // Update configuration (workspace level by default)
        await config.update('target', chosen, getSettingsTarget());
        vscode.window.showInformationMessage(`Target set to: ${chosen}`);
      }
    }
  );

  // Register command: flash
  const flashCmd = vscode.commands.registerCommand(
    'pyocd-one-click-loader.flash',
    flash
  );

  // Register command: toggle resetAfterLoad setting
  const toggleResetCmd = vscode.commands.registerCommand(
    'pyocd-one-click-loader.toggleReset',
    async () => {
      const config = vscode.workspace.getConfiguration('pyocd-one-click-loader', getWorkspaceScopeUri());
      const current = config.get('resetAfterLoad', true);
      const next = !current;
      await config.update('resetAfterLoad', next, getSettingsTarget());
      vscode.window.showInformationMessage(`pyocd-one-click-loader.resetAfterLoad set to ${next}`);
    }
  );

  context.subscriptions.push(selectTargetCmd, flashCmd, toggleResetCmd);

  // Create a status bar button for the flash command
  const flashStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  flashStatusBar.text = '⚡Flash';
  flashStatusBar.command = 'pyocd-one-click-loader.flash';
  flashStatusBar.tooltip = 'Flash firmware with pyOCD';
  flashStatusBar.show();
  context.subscriptions.push(flashStatusBar);

  // Optional: warn on activation if pyOCD is missing
  checkPyOCD().then(ok => {
    if (!ok) {
      vscode.window.showWarningMessage(
        'PyOCD not found. Please install pyOCD to use PyOCD One-Click Programmer.'
      );
    }
  });
}

function deactivate() {
  disposeFlashResources();
}

module.exports = { activate, deactivate };