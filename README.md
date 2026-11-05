<h1 align="center">Discord Presence</h1>

<p align="center">
  English | <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  A VS Code extension that shows the file you are editing, its language, and your workspace on Discord.<br>
  No runtime dependencies: it talks to Discord through its local IPC with Node.js built-ins only.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.144%2B-007ACC" alt="VS Code 1.144+">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6">
  <img src="https://img.shields.io/badge/Discord-Rich%20Presence-5865F2?logo=discord&logoColor=white" alt="Discord Rich Presence">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D4" alt="Platform: Windows">
  <br>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT"></a>
  <a href="https://github.com/necotan/vscode-discord-presence/releases/latest"><img src="https://img.shields.io/github/v/release/necotan/vscode-discord-presence?label=Release" alt="Latest release"></a>
</p>

## Features

Your Discord profile shows **Playing Visual Studio Code** with:

- `Editing <file name>`
- `In <workspace name>` (the folder name, or the name of the `.code-workspace` file; an unsaved multi-root workspace has no name, so this line is not shown until you save it)
- The language icon (hover to see the language name), with the VS Code logo in the corner
- The elapsed time since the VS Code window opened

It switches to `Idling` when no file is open, or when VS Code has not been focused for 5 minutes (configurable).

With several VS Code windows open, the window you focused last is shown.

**Discord** in the status bar shows the state of each window: shown on Discord, Discord not found, another window shown, hidden, or off. Hover for details, or click for a menu (turn off or on, reconnect, show the log, open the settings). To remove it, right-click the status bar and uncheck **Discord Presence**.

## Requirements

- Windows
- The Discord desktop app (Discord in a browser is not supported)
- VS Code 1.144 or later
- In Discord, **User Settings > Activity Privacy > share your detected activities** must be on.

Remote-SSH, WSL, and Dev Containers work: the extension runs on your local machine, where Discord is.

## Installation

This extension is not on the Marketplace. Install it from a `.vsix` file.

1. Get `vscode-discord-presence-<version>.vsix` (from the Releases page, or build it yourself; see [Development](#development)).
2. In VS Code, open the Command Palette (`Ctrl+Shift+P`) and run **Extensions: Install from VSIX...**, then choose the file.

To update, install the new `.vsix` the same way. To uninstall, use the Extensions view.

## Settings

| Setting | Default | Description |
|---|---|---|
| `discordPresence.enabled` | `true` | Show your VS Code activity on Discord |
| `discordPresence.clientId` | `""` | Application ID of your own Discord application, to change the name after "Playing"; empty uses the built-in one ("Visual Studio Code") |
| `discordPresence.showFileName` | `true` | Show the file name (`Editing a file` when off) |
| `discordPresence.showLanguage` | `true` | Show the language name and icon (VS Code logo only when off) |
| `discordPresence.showVSCodeLogo` | `true` | Show the small VS Code logo in the corner of the language icon |
| `discordPresence.showWorkspace` | `true` | Show the workspace name |
| `discordPresence.hiddenWorkspaces` | `[]` | Workspace names or folder paths where the activity is hidden (see below) |
| `discordPresence.hiddenWorkspaceMode` | `"hide"` | `hide` shows nothing; `mask` shows only `Editing a file` and the VS Code logo |
| `discordPresence.idleTimeoutMinutes` | `5` | Minutes after VS Code loses focus before showing `Idling`; `0` is immediate |

The elapsed time cannot be hidden: when it is not sent, Discord counts its own.

### Hiding Specific Workspaces

Add workspace names or folder paths to `discordPresence.hiddenWorkspaces` in your user settings. Nothing needs to be added to the workspace itself.

```json
"discordPresence.hiddenWorkspaces": ["school-report", "C:/work"],
"discordPresence.hiddenWorkspaceMode": "hide"
```

- An item with `/` or `\` is a folder path and also covers the folders inside it (`C:/work` hides `C:/work/app`). Any other item is a workspace name, the name after "In". Case is ignored. In `settings.json`, write `\` as `\\`, or use `/`.
- In a multi-root workspace, one matching folder hides the whole window.
- In Remote-SSH, WSL, and Dev Containers, write the remote path (e.g. `/home/me/work`).
- `hide`: Discord shows nothing while that window is the last focused one. `mask`: Discord shows `Editing a file` with the VS Code logo, without the file, language, or workspace name.

### Changing the Name After "Playing"

The name is the name of the Discord application the extension connects as. To show a different one:

1. In the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application** and name it what you want to show (e.g. `VS Code`).
2. Copy the **Application ID** from **General Information**.
3. Paste it into `discordPresence.clientId`. The extension reconnects and shows the new name within a few seconds.

No other setup in the Developer Portal is needed; the icons are loaded from GitHub. Clear the setting to go back to "Visual Studio Code".

## Commands

| Command | Description |
|---|---|
| **Discord Presence: Reconnect** | Reconnect to Discord now |
| **Discord Presence: Toggle** | Turn `discordPresence.enabled` on or off (in the workspace settings if it is set there, otherwise in the user settings) |
| **Discord Presence: Show Log** | Open the log |

Logs are in the **Output** panel under **Discord Presence**.

## What Is Sent to Discord

Only to the Discord app on your own machine, through its local named pipe:

- The base name of the active file (e.g. `extension.ts`)
- The language name
- The workspace name (the folder name, or the name of the `.code-workspace` file)
- The time the window opened

Never sent: full paths, file contents, Git information, or anything else. Everything shown is visible to anyone who can see your Discord profile, so use the settings above to hide what should stay private.

The extension makes no network requests. Discord loads the icons from this repository on GitHub.

## Development

### Prerequisites

- Node.js and npm
- The Discord desktop app, running

### Steps

```bash
npm install
npm run compile
```

Press `F5` in VS Code to open an Extension Development Host with the extension loaded.

### npm Scripts

| Command | Description |
|---|---|
| `npm run compile` | Build with `tsc` into `out/` |
| `npm run watch` | Rebuild on change |
| `npm run lint` | ESLint |
| `npm test` | Unit tests in the extension host |
| `npm run generate:icons` | Regenerate `assets/icons/*.png` from devicon (needs Chrome or Edge) |

### Packaging

```bash
npx @vscode/vsce@4.0.0 package
```

### Specifications

- [docs/requirements.md](docs/requirements.md): display rules, settings, commands, multi-window behavior
- [docs/discord-ipc.md](docs/discord-ipc.md): the Discord IPC protocol as used here

## Credits

- Language icons and the VS Code logo: [devicon](https://github.com/devicons/devicon) v2.17.0, MIT License ([assets/icons/LICENSE-devicon.txt](assets/icons/LICENSE-devicon.txt)), converted to PNG.
- The logos are trademarks of their respective owners. Visual Studio Code is a trademark of Microsoft. This extension is not affiliated with or endorsed by Microsoft or Discord.

## License

[MIT License](LICENSE)
