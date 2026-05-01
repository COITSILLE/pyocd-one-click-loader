const vscode = require('vscode');
const { pickTarget } = require('./src/targets');
const { flash } = require('./src/flash');
const { checkPyOCD, checkPython } = require('./src/utils');

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

      const config = vscode.workspace.getConfiguration('pyocd-one-click-loader');
      const current = config.get('target', '');

      const chosen = await pickTarget(current);
      if (chosen) {
        // Update configuration (workspace level by default)
        await config.update('target', chosen, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Target set to: ${chosen}`);
      }
    }
  );

  // Register command: flash
  const flashCmd = vscode.commands.registerCommand(
    'pyocd-one-click-loader.flash',
    flash
  );

  context.subscriptions.push(selectTargetCmd, flashCmd);

  // Create a status bar button for the flash command (闪电图案)
  const flashStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  flashStatusBar.text = '⚡ Flash';
  flashStatusBar.command = 'pyocd-one-click-loader.flash';
  flashStatusBar.tooltip = 'Flash firmware with pyOCD';
  flashStatusBar.show();
  context.subscriptions.push(flashStatusBar);

  // Optional: warn on activation if pyOCD is missing
  checkPyOCD().then(ok => {
    if (!ok) {
      vscode.window.showWarningMessage(
        'PyOCD not found. Please install pyOCD to use PyOCD One-Click Loader.'
      );
    }
  });
}

function deactivate() {}

module.exports = { activate, deactivate };