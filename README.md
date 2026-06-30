# PyOCD One-Click Programmer / PyOCD 一键烧录

[中文](#中文) | [English](#english)

## English

A VS Code extension for one-click firmware flashing with pyOCD. Auto-discovers firmware files (`.elf`, `.hex`, etc.), provides target selection, and flashes with a single click.

### Features

- Status bar **?Flash** button for one-click flashing.
- Auto-detects firmware files by configured extensions (default: `.elf`, `.hex`) with priority order. When multiple formats exist for the same base name, only the highest-priority one is shown.
- Prefers common build folders (`build/`, `out/`, `Debug/`, `Release/`, `bin/`).

### Requirements

- `pyocd` must be installed and on PATH: `pip install pyocd`
- Python 3 recommended.

### Usage

1. Run **PyOCD: Select Target** to choose your board; or just click Flash and pick when prompted.
2. Build your project to produce a firmware file (e.g. `.elf`, `.hex`).
3. Click the **?Flash** status bar button or run **PyOCD: Flash**, pick the firmware file, done.

### Commands

| Command | Description |
|---------|-------------|
| `PyOCD: Select Target` | Choose target chip |
| `PyOCD: Flash` | Pick a firmware file and flash |
| `PyOCD: Toggle Reset After Load` | Toggle post-flash reset |

### Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pyocd-one-click-loader.target` | string | `""` | Target name, e.g. `stm32f407vgtx` |
| `pyocd-one-click-loader.resetAfterLoad` | boolean | `true` | Reset after load (`false` passes `--no-reset`) |
| `pyocd-one-click-loader.firmwareExtensions` | string[] | `[".elf", ".hex"]` | Firmware file extensions to search for, in priority order. Example: `[".elf", ".hex", ".bin"]` |
| `pyocd-one-click-loader.elfSearchPaths` | string[] | `[]` | Custom firmware search dirs, e.g. `["build", "out/Debug"]`. Leave empty to auto-detect. |

> In folder workspaces, settings are written to the current folder's `.vscode/settings.json`.

### Troubleshooting

- **No firmware files found**: Build the project, or set `elfSearchPaths` to point to your output directory.
- **pyOCD not found**: Run `pyocd --version` in a terminal to verify installation. If you did install, run `Developer: Reload Window` may work

---

## 中文

一个 VS Code 扩展，使用 pyOCD 快速烧录固件。自动发现工作区中的固件文件（如 `.elf`、`.hex`），提供目标芯片选择，一键完成烧录。

### 功能

- 状态栏 **?Flash** 按钮，一键烧录。
- 自动发现固件文件（默认 `.elf`、`.hex`），按配置的扩展名顺序去重。同名文件仅保留最高优先级的格式。
- 优先搜索常见构建目录（`build/`、`out/`、`Debug/`、`Release/`、`bin/`）。

### 依赖

- 需安装 `pyocd` 并加入 PATH：`pip install pyocd`
- 建议安装 Python 3。

### 使用方法

1. 通过命令面板运行 **PyOCD: Select Target** 选择目标芯片；或直接点 Flash，扩展会提示你选择。
2. 构建项目生成固件文件（如 `.elf`、`.hex`）。
3. 点击状态栏 **?Flash** 按钮或运行 **PyOCD: Flash**，选择固件文件，等待烧录完成。

### 命令

| 命令 | 说明 |
|------|------|
| `PyOCD: Select Target` | 选择目标芯片 |
| `PyOCD: Flash` | 选择固件文件并烧录 |
| `PyOCD: Toggle Reset After Load` | 切换烧录后是否复位 |

### 配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pyocd-one-click-loader.target` | string | `""` | 目标芯片名称，如 `stm32f407vgtx` |
| `pyocd-one-click-loader.resetAfterLoad` | boolean | `true` | 烧录后是否复位（`false` 传 `--no-reset`） |
| `pyocd-one-click-loader.firmwareExtensions` | string[] | `[".elf", ".hex"]` | 固件文件扩展名列表，按优先级排序。例如 `[".elf", ".hex", ".bin"]` |
| `pyocd-one-click-loader.elfSearchPaths` | string[] | `[]` | 自定义固件搜索目录，如 `["build", "out/Debug"]`，留空则自动检测 |

> 文件夹工作区中，配置写入当前文件夹的 `.vscode/settings.json`。

### 常见问题

- **找不到固件文件**：构建项目，或通过 `elfSearchPaths` 配置指定固件文件所在目录。
- **找不到 pyOCD**：在终端运行 `pyocd --version` 确认已安装。如果确实安装了，执行`Developer: Reload Window`可能可以解决

---



[CHANGELOG](./CHANGELOG.md)
