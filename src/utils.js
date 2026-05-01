const { execFile } = require('child_process');
const vscode = require('vscode');

/**
 * Check if pyOCD is available in PATH.
 * Resolves with true if `pyocd --version` succeeds, else false.
 */
function checkPyOCD() {
  return new Promise((resolve) => {
    execFile('pyocd', ['--version'], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Check if Python 3 is available (optional, just for better message).
 */
function checkPython() {
  return new Promise((resolve) => {
    execFile('python3', ['--version'], { timeout: 5000 }, (error) => {
      if (!error) return resolve(true);
      execFile('python', ['--version'], { timeout: 5000 }, (err2) => {
        resolve(!err2);
      });
    });
  });
}

/**
 * Execute a command in a new terminal and show the command.
 */
function runInTerminal(command) {
  const name = 'PyOCD Loader';
  let terminal = vscode.window.terminals.find(t => t.name === name);
  if (!terminal) {
    terminal = vscode.window.createTerminal(name);
  }
  terminal.show();
  terminal.sendText(command);
}

module.exports = { checkPyOCD, checkPython, runInTerminal };