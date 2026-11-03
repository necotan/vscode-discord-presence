<h1 align="center">Discord Presence</h1>

<p align="center">
  English | <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  A VS Code extension that shows the file you are editing, its language, and your workspace on Discord.<br>
  No runtime dependencies: it talks to Discord through its local IPC with Node.js built-ins only.
</p>

## Features

Your Discord profile shows **Playing Visual Studio Code** with:

- `Editing <file name>`
- `In <workspace name>`
- The language icon (hover to see the language name), with the VS Code logo in the corner
- The elapsed time since the VS Code window opened

It switches to `Idling` when no file is open, or when VS Code has not been focused for 5 minutes (configurable).

With several VS Code windows open, the window you focused last is shown.

## Requirements

- Windows
- The Discord desktop app (Discord in a browser is not supported)
- VS Code 1.144 or later
- In Discord, **User Settings > Activity Privacy → share your detected activities** must be on.

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
| `discordPresence.clientId` | `""` | Client ID of your own Discord application; empty uses the built-in one |
| `discordPresence.showFileName` | `true` | Show the file name (`Editing a file` when off) |
| `discordPresence.showLanguage` | `true` | Show the language name and icon (VS Code logo only when off) |
| `discordPresence.showWorkspace` | `true` | Show the workspace name |
| `discordPresence.idleTimeoutMinutes` | `5` | Minutes after VS Code loses focus before showing `Idling`; `0` is immediate |

The elapsed time cannot be hidden: when it is not sent, Discord counts its own.

## Commands

| Command | Description |
|---|---|
| **Discord Presence: Reconnect** | Reconnect to Discord now |
| **Discord Presence: Toggle** | Turn `discordPresence.enabled` on or off (user settings) |

Logs are in the **Output** panel under **Discord Presence**.

## What Is Sent to Discord

Only to the Discord app on your own machine, through its local named pipe:

- The base name of the active file (e.g. `extension.ts`)
- The language name
- The workspace name
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

[MIT](LICENSE)
