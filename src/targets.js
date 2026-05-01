const vscode = require('vscode');
const { execFile } = require('child_process');
const { checkPyOCD } = require('./utils');

let cachedTargets = null; // [{name, vendor, part}]

/**
 * Parse the output of `pyocd list --targets` into an array of objects.
 * Expected format (simplified):
 *   Name                          Vendor                  Part Number
 *   ---------------------------------------------------------------
 *   stm32f103rb                   STMicroelectronics      STM32F103RB
 */
function parseTargetList(stdout) {
  const lines = stdout.split(/\r?\n/);
  const targets = [];
  let headerFound = false;
  for (const line of lines) {
    if (!headerFound) {
      if (line.includes('Name') && line.includes('Vendor')) {
        headerFound = true;
      }
      continue;
    }
    if (line.trim() === '' || line.startsWith('---')) continue;
    // Simple split by multiple spaces
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      targets.push({
        name: parts[0].trim(),
        vendor: parts[1].trim(),
        part: parts[2].trim()
      });
    }
  }
  return targets;
}

/**
 * Get all pyOCD targets (cached).
 */
async function getTargets() {
  if (cachedTargets) return cachedTargets;
  return new Promise((resolve, reject) => {
    execFile('pyocd', ['list', '--targets'], { timeout: 10000 }, (error, stdout) => {
      if (error) {
        return reject(new Error('Failed to get target list. Is pyOCD installed?'));
      }
      cachedTargets = parseTargetList(stdout);
      resolve(cachedTargets);
    });
  });
}

/**
 * Refresh cached target list (e.g., after pyOCD update).
 */
async function refreshTargets() {
  cachedTargets = null;
  return getTargets();
}

/**
 * Show a QuickPick with all targets and return selected name or undefined.
 * If currentTarget is provided, it will be pre‑selected.
 */
async function pickTarget(currentTarget) {
  let targets;
  try {
    targets = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Loading pyOCD targets...',
      cancellable: false
    }, async () => {
      return await getTargets();
    });
  } catch (err) {
    vscode.window.showErrorMessage('Failed to load pyOCD targets. Is pyOCD installed?');
    return undefined;
  }
  const items = targets.map(t => ({
    label: t.name,
    description: t.part,
    detail: `Vendor: ${t.vendor}`
  }));

  // If there is a current target, move it to the top
  if (currentTarget) {
    const idx = items.findIndex(i => i.label === currentTarget);
    if (idx > 0) {
      const [item] = items.splice(idx, 1);
      items.unshift(item);
    }
  }

  const chosen = await vscode.window.showQuickPick(items, {
    placeHolder: 'Search or choose a target (e.g. stm32f407)',
    matchOnDescription: true,
    matchOnDetail: true
  });
  return chosen ? chosen.label : undefined;
}

module.exports = { getTargets, refreshTargets, pickTarget };