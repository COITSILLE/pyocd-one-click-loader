# PyOCD One-Click Loader

A VS Code extension for quickly flashing firmware using pyOCD. The extension auto-discovers ELF files in the workspace, provides target selection, and offers a one-click flash workflow.

Features

- Status bar `âš? Flash` button to start flashing with a single click.
- Auto-detects `.elf` files in the workspace, preferring common firmware build folders such as `build/**`, `out/**`, `Debug/**`, `Release/**`, and `bin/**`.
- If no target is configured, prompts to select one and continues flashing.
- Shows a loading notification while fetching pyOCD targets.
- Reuses a terminal named `PyOCD Loader` to keep flash output history.

Requirements

- `pyocd` must be installed and available on PATH (install with `pip install pyocd`).
- Python 3 is recommended.

Usage

1. Run `PyOCD: Select Target` from the command palette to choose your board target. If you run `PyOCD: Flash` without a configured target, the extension will prompt you to select one.
2. Build your project to produce a `.elf` file. The extension will look in common build output folders first, then fall back to the rest of the workspace.
3. Click the `âš? Flash` status bar button on the right or run `PyOCD: Flash`, pick the ELF file, and wait for the flashing to complete.

Commands

- `PyOCD: Select Target` — choose the board target to use for flashing.
- `PyOCD: Flash` — pick an ELF and flash it to the target (also available via the status bar `? Flash` button).
- `PyOCD: Toggle Reset After Load` — toggle the `pyocd-one-click-loader.resetAfterLoad` workspace setting (when off, `--no-reset` is passed to `pyocd load`).

Configuration

- `pyocd-one-click-loader.target` (string): Target name to use for pyOCD (e.g. `stm32f407vgtx`). Stored at workspace level.

- `pyocd-one-click-loader.resetAfterLoad` (boolean): Whether to reset the target after `pyocd load`. Defaults to `true`. Set to `false` to pass the `--no-reset` flag to `pyocd load`.

Note: in a folder workspace these settings are written to the current folder's `.vscode/settings.json`.

Troubleshooting

- No `.elf` files found: build the project or ensure your ELF is in one of the common output folders, or somewhere else in the workspace.
- pyOCD not found: run `pyocd --version` in a terminal to verify installation.

Contributing

Contributions, bug reports, and feature requests are welcome. Please include reproduction steps and any relevant logs when opening an issue.

---

See the source code and CHANGELOG for more details.
