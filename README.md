# PyOCD One-Click Loader

A VS Code extension for quickly flashing firmware using pyOCD. The extension auto-discovers ELF files in the workspace, provides target selection, and offers a one-click flash workflow.

Features

- Status bar `⚡ Flash` button to start flashing with a single click.
- Auto-detects `.elf` files in the workspace (prefers `build/**`).
- If no target is configured, prompts to select one and continues flashing.
- Shows a loading notification while fetching pyOCD targets.
- Reuses a terminal named `PyOCD Loader` to keep flash output history.

Requirements

- `pyocd` must be installed and available on PATH (install with `pip install pyocd`).
- Python 3 is recommended.

Usage

1. Run `PyOCD: Select Target` from the command palette to choose your board target. If you run `PyOCD: Flash` without a configured target, the extension will prompt you to select one.
2. Build your project to produce a `.elf` file (commonly under `build/`).
3. Click the `⚡ Flash` status bar button on the right or run `PyOCD: Flash`, pick the ELF file, and wait for the flashing to complete.

Configuration

- `pyocd-one-click-loader.target` (string): Target name to use for pyOCD (e.g. `stm32f407vgtx`). Stored at workspace level.

Troubleshooting

- No `.elf` files found: build the project or ensure your ELF is in the workspace (check `build/`).
- pyOCD not found: run `pyocd --version` in a terminal to verify installation.

Contributing

Contributions, bug reports, and feature requests are welcome. Please include reproduction steps and any relevant logs when opening an issue.

---

See the source code and CHANGELOG for more details.
