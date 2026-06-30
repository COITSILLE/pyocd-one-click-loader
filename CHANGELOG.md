# Change Log

All notable changes to the "pyocd-one-click-loader" extension are documented here.

## [1.3.1]
- **Configurable firmware extensions**: Added `firmwareExtensions` setting to customize which file extensions to search for (default: `[".elf", ".hex"]`). Extensions are ordered by priority — first match wins when same base name.
- Updated all search paths, file watcher, and error messages to respect the configured extensions.

## [1.3.0]
- **Multi-format firmware search**: Now searches for `.elf`, `.hex`, and `.bin` files with priority (elf > hex > bin). When multiple formats exist for the same base name, only the highest-priority one is shown.
- Updated `elfSearchPaths` to search all three formats in the configured directories.

## [1.2.1]
- fix README encoding, detail troubleshooting

## [1.2.0]
- **Performance**: `pyocd --version` check result is cached after first call, eliminating per-click process spawning overhead.
- Add `pyocd-one-click-loader.elfSearchPaths` configuration to specify custom directories for .elf discovery (e.g. `["build", "out/Debug"]`). Speeds up first scan and avoids searching irrelevant folders.

## [1.1.1]
- Improve ELF discovery to prefer common firmware build output folders and support multi-root workspaces.
- Add configuration `pyocd-one-click-loader.resetAfterLoad` (default: true) to control whether the target is reset after `pyocd load` (set to false to pass `--no-reset`).
- Add command `PyOCD: Toggle Reset After Load` to quickly toggle the setting from the command palette.
- In a folder workspace, settings are written to the current folder's `.vscode/settings.json`.

## [1.1.0]
- Replace `pyocd flash` with `pyocd load` 

## [1.0.0]

- Add status bar flash button (`�? Flash`).
- Automatically prompt to select target when none is configured, then continue flashing.
- Show a loading notification while fetching pyOCD targets.
- Reuse terminal named `PyOCD Programmer` for flash commands.

## [0.0.1] - Initial release

- Initial scaffolding and commands: `selectTarget`, `flash`.