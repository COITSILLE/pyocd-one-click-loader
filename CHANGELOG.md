# Change Log

All notable changes to the "pyocd-one-click-loader" extension are documented here.
## [1.1.1]
- Improve ELF discovery to prefer common firmware build output folders and support multi-root workspaces.
- Add configuration `pyocd-one-click-loader.resetAfterLoad` (default: true) to control whether the target is reset after `pyocd load` (set to false to pass `--no-reset`).
- Add command `PyOCD: Toggle Reset After Load` to quickly toggle the setting from the command palette.
- In a folder workspace, settings are written to the current folder's `.vscode/settings.json`.

## [1.1.0]
- Replace `pyocd flash` with `pyocd load` 

## [1.0.0]

- Add status bar flash button (`âš? Flash`).
- Automatically prompt to select target when none is configured, then continue flashing.
- Show a loading notification while fetching pyOCD targets.
- Reuse terminal named `PyOCD Loader` for flash commands.

## [0.0.1] - Initial release

- Initial scaffolding and commands: `selectTarget`, `flash`.