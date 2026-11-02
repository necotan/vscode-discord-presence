# Requirements Specification

This document is the source of truth for what vscode-discord-presence does and why. How the extension talks to Discord (pipe path, frames, handshake, activity payload, rate limiting, reconnect) is in `docs/discord-ipc.md`. How to work in this repository (commands, coding rules, commits) is in `CLAUDE.md`.

Behavior marked **[live test]** depends on the Discord client and has not been confirmed. Confirm it on a real Discord client before relying on it, then replace the marker with the result.

## Glossary

| Term | Code | Meaning |
|---|---|---|
| Activity | `activity` in `SET_ACTIVITY` | What Discord shows on the user's profile and in the member list. Also called Rich Presence. |
| Normal display | `activityBuilder` input with an editor | The activity while a file is open (see 5.1). |
| Idle display | `activityBuilder` input with `idle: true` | The activity while not working (see 5.2). |
| Window | one extension host process | Each VS Code window runs its own copy of the extension, with its own IPC connection. |
| Client ID | `discordPresence.clientId`, `DEFAULT_CLIENT_ID` | The ID of a Discord application registered in the Discord Developer Portal. Its name appears as the activity title. |
| Start time | `timestamps.start` | The origin of the elapsed time shown by Discord (see 5.4). |

## 1. Overview

A VS Code extension that shows what the user is working on as a Discord activity: the file name, the language with its icon, the workspace name, and the elapsed time.

- **Name (repository and package)**: `vscode-discord-presence`
- **Discord application name**: `Visual Studio Code`, shown as the activity title (e.g. "Playing Visual Studio Code"). Registered in the Discord Developer Portal; its Application ID is `DEFAULT_CLIENT_ID`.
- **Users**: the author and friends.
- **Distribution**: a `.vsix` file installed manually. The extension is not published to the Marketplace (see 12).

## 2. Supported Environments

| Environment | Support |
|---|---|
| Windows | Supported |
| Linux | Planned. Only the pipe path differs (`discord-ipc.md` §1). |
| macOS | Undecided |
| Remote-SSH, WSL, Dev Containers | Supported through `"extensionKind": ["ui"]`: the extension runs on the local machine, where Discord runs, while the workspace is remote. |
| Discord desktop app | Required. Discord in a browser has no IPC and is not supported. |

- VS Code: the version in `engines.vscode` of `package.json` (currently `^1.144.0`).

## 3. Technology Stack

- **Language**: TypeScript (strict)
- **Build**: `tsc` into `out/`, no bundler
- **Package manager**: npm
- **Runtime dependencies**: none. The Discord IPC client is written with Node.js built-ins (`net`).
  - Reason: no supply-chain risk in what friends install, a small `.vsix`, and no bundler needed for `node_modules`.
- **Tests**: Mocha in the extension host via `@vscode/test-cli` and `@vscode/test-electron`
- **Lint**: ESLint with typescript-eslint
- **Packaging**: `@vscode/vsce` (run with `npx`; not added to `devDependencies`)

## 4. Privacy and Data Sent

The extension sends data only to the Discord desktop app on the same machine, over its local named pipe. It makes no network requests itself.

| Data | Source | Setting that hides it |
|---|---|---|
| File base name (e.g. `extension.ts`) | active text editor | `showFileName` |
| Language display name | `document.languageId` via `src/languages.ts` | `showLanguage` |
| Workspace name | `vscode.workspace.name` | `showWorkspace` |
| Start time | time of `activate` | `showElapsedTime` |
| Process ID | `process.pid` | (required by `SET_ACTIVITY`, not shown) |

- NEVER sent: full paths, folder names other than the workspace name, file contents, Git branch or remote, user names.
- Everything in the activity is visible to anyone who can see the user's Discord profile. The `show*` settings exist so the user can hide what should not be public.
- Icon images are fetched by Discord from GitHub raw URLs (see 6.2), not by the extension.
- The Client ID is public information and may be embedded. A Client Secret or bot token is not needed and must never be in the code.

## 5. Display Specification

### 5.1 Normal Display (a file is open)

| Discord field | Content | Example | Setting |
|---|---|---|---|
| `details` | `Editing <file name>` | `Editing extension.ts` | `showFileName` |
| `state` | `In <workspace name>` | `In vscode-discord-presence` | `showWorkspace` |
| `assets.large_image` | Language icon URL | `<ICON_BASE_URL>/typescript.png` | `showLanguage` |
| `assets.large_text` | Language display name | `TypeScript` | `showLanguage` |
| `assets.small_image` | VS Code logo URL | `<ICON_BASE_URL>/vscode.png` | always |
| `assets.small_text` | `Visual Studio Code` | | always |
| `timestamps.start` | Start time (epoch ms) | | `showElapsedTime` |

- `showFileName` is false: `details` is `Editing a file`.
- `showLanguage` is false: `large_image` is the VS Code logo, `large_text` is `Visual Studio Code`, and `small_image` / `small_text` are omitted.
- `showWorkspace` is false, or no folder or workspace is open: `state` is omitted.
- `showElapsedTime` is false: `timestamps` is omitted.
- String fields are limited to 128 characters; longer text is cut and ends with `…` (`discord-ipc.md` §5). Very short strings (1 character) are reported to be rejected **[live test]**.
- The file name of an untitled editor is its title (e.g. `Untitled-1`).

### 5.2 Idle Display

- `details`: `Idling`
- `large_image`: VS Code logo; `large_text`: `Visual Studio Code`
- `state`, the language icon, and `small_image` are omitted.
- `timestamps.start` keeps the same start time as the normal display (idle does not reset it), unless `showElapsedTime` is false.

### 5.3 Switching to Idle

| Situation | Behavior |
|---|---|
| No active text editor (all files closed, or a non-text editor is active) | Idle display immediately |
| The VS Code window loses focus | Idle display after `idleTimeoutMinutes` minutes |
| The window regains focus, or a text editor becomes active | Normal display immediately; the idle timer is cancelled |

- Focus is read from `vscode.window.state.focused` and `vscode.window.onDidChangeWindowState`.
- `idleTimeoutMinutes` is 0: idle display as soon as focus is lost.
- The active editor is `vscode.window.activeTextEditor`, followed by `onDidChangeActiveTextEditor`. How to treat webviews, custom editors, notebooks, and the output panel is an open question (see 14).

### 5.4 Elapsed Time

- The start time is when the extension activated in that window (`activate`).
- Each window has its own start time, because each window runs its own extension host. This is accepted for now. Sharing it through `context.globalState` is a future candidate.
- Toggling `enabled` off and on keeps the start time.

### 5.5 Multiple Windows

- Every window connects to Discord on its own.
- **The last focused window is shown.** When a window gains focus, it sends its activity at once (still through the throttle in `discord-ipc.md` §6), overwriting the others.
- A window that loses focus does not clear the activity, so it does not erase what another window shows. Its idle timer still runs.
- Which activity Discord shows when several processes send `SET_ACTIVITY` with the same Client ID is **[live test]**. If the latest one does not win, change the design (for example, a window that loses focus closes its connection) and update this section.

## 6. Language Names and Icons

### 6.1 Language Names

- The VS Code API gives only `document.languageId` (e.g. `typescriptreact`), so `src/languages.ts` maps it to a display name and an icon name.
- A `languageId` that is not in the map is shown as is, with the VS Code logo.

```ts
export const LANGUAGES: Record<string, { name: string; icon?: string }> = {
  typescript: { name: 'TypeScript', icon: 'typescript' },
  typescriptreact: { name: 'TypeScript React', icon: 'react' },
  javascript: { name: 'JavaScript', icon: 'javascript' },
  python: { name: 'Python', icon: 'python' },
};
```

### 6.2 Icons

- Stored in the repository as `assets/icons/<icon>.png` and passed to Discord as GitHub raw URLs.
  - Base URL: `https://raw.githubusercontent.com/necotan/vscode-discord-presence/main/assets/icons`, defined once as `ICON_BASE_URL` in `src/config.ts`.
  - The repository must be public, or Discord cannot fetch the images.
- A language without `icon` uses `vscode.png`. The extension does not check whether a URL exists (that would need a network request).
- Format: PNG, square, about 512×512.
- Use only images whose license allows it (for example, devicon is MIT). List the sources and licenses in the README.
- Whether Discord displays external image URLs in `large_image` / `small_image`, and how long it caches them after an image changes, is **[live test]**.

## 7. Settings (`contributes.configuration`)

| Key | Type | Default | Description |
|---|---|---|---|
| `discordPresence.enabled` | boolean | `true` | Turns the whole extension on or off |
| `discordPresence.clientId` | string | `""` | Discord application Client ID; empty uses `DEFAULT_CLIENT_ID` |
| `discordPresence.showFileName` | boolean | `true` | Show the file name |
| `discordPresence.showLanguage` | boolean | `true` | Show the language name and icon |
| `discordPresence.showWorkspace` | boolean | `true` | Show the workspace name |
| `discordPresence.showElapsedTime` | boolean | `true` | Show the elapsed time |
| `discordPresence.idleTimeoutMinutes` | number | `5` | Minutes after losing focus before the idle display; `0` is immediate. Minimum `0`. |

- `DEFAULT_CLIENT_ID` in `src/config.ts` is filled in by the author after registering the Discord application.
- Changes are applied at once through `onDidChangeConfiguration`:
  - `show*` and `idleTimeoutMinutes`: rebuild and resend the activity.
  - `clientId`: disconnect and reconnect with the new ID.
  - `enabled` false: clear the activity and disconnect. `enabled` true: connect.

## 8. Commands

| Command ID | Title | Behavior |
|---|---|---|
| `discordPresence.reconnect` | Discord Presence: Reconnect | Disconnect, then connect at once (without waiting for the reconnect interval) |
| `discordPresence.toggle` | Discord Presence: Toggle | Invert `discordPresence.enabled` in the user (global) settings |

The template command `vscode-discord-presence.helloWorld` is removed in milestone 1.

## 9. Connection and Error Handling

| Situation | Behavior |
|---|---|
| Discord is not running | Normal state. Log only, no notification. Retry every 15 s. |
| Connection lost | Retry every 15 s. After reconnecting, send the current activity again. |
| Discord sends `CLOSE` (e.g. invalid Client ID) | Log its code and message, treat as disconnected, retry every 15 s. |
| `SET_ACTIVITY` returns `evt: "ERROR"` | Log it. Do not retry the same activity. |
| `enabled` is false | No connection and no retries. |
| `deactivate` | Clear the activity, then close the pipe (`discord-ipc.md` §8). |

- No error may escape from an event handler or a timer. Catch and log every connection and protocol error.
- Logs go to a `LogOutputChannel` named `Discord Presence` (`vscode.window.createOutputChannel(name, { log: true })`).
- The extension does not show notifications for connection state. A status bar indicator is a future candidate.

## 10. Module Structure

```
vscode-discord-presence/
├── CLAUDE.md
├── docs/
│   ├── requirements.md
│   └── discord-ipc.md
├── assets/icons/                  # language icons and vscode.png
└── src/
    ├── extension.ts               # activate / deactivate, wiring only
    ├── config.ts                  # settings, DEFAULT_CLIENT_ID, ICON_BASE_URL
    ├── languages.ts               # languageId → display name and icon
    ├── ipc/
    │   ├── getIpcPath.ts          # pipe path per OS (Windows only for now)
    │   ├── frame.ts               # frame encode/decode with buffering (pure)
    │   └── discordIpc.ts          # connect, handshake, send, reconnect
    ├── presence/
    │   ├── activityBuilder.ts     # state + settings → activity (pure)
    │   └── presenceController.ts  # editor and focus events, idle, debounce, throttle
    └── test/                      # unit tests for frame and activityBuilder
```

- `frame.ts` and `activityBuilder.ts` do not import `vscode`, so they can be tested with plain values.
- `discordIpc.ts` knows nothing about editors; `presenceController.ts` knows nothing about frames.

`package.json`:

- `"activationEvents": ["onStartupFinished"]`
- `"extensionKind": ["ui"]`
- `"dependencies"`: none

## 11. Testing

- Unit tests (`npm test`):
  - `frame.ts`: encoding; decoding a frame split across chunks, several frames in one chunk, and multi-byte UTF-8 JSON.
  - `activityBuilder.ts`: every row and rule in 5.1 and 5.2, each `show*` setting, truncation at 128 characters.
- Manual tests: F5 (Extension Development Host) with the Discord desktop app running. Each milestone in 13 lists what to check.
- There are no automated tests against a real Discord client.

## 12. Distribution

- Build with `npx @vscode/vsce package`; install with "Extensions: Install from VSIX...".
- Before the first package, `package.json` needs `publisher`, `repository`, and `license`, and the README must replace the `yo code` template (vsce rejects the template README).
- The README covers installation, settings, commands, what is sent to Discord (4), and icon sources and licenses.
- `.vscodeignore` keeps `src/`, tests, and maps out of the `.vsix`. `assets/icons/` is served from GitHub, so it can be excluded as well.

## 13. Milestones

Each milestone ends with manual test steps for the user. The next one starts after the user confirms.

1. **IPC connection**: connect to the pipe, handshake, receive `READY`, show a fixed test activity. Remove the `helloWorld` template.
2. **Basic display**: show the active file name, `languageId`, workspace name, and elapsed time; switching tabs updates the activity through the debounce and throttle.
3. **Idle and multiple windows**: implement 5.2–5.5 and run the multi-window live test.
4. **Settings and commands**: implement 7 and 8; setting changes apply at once.
5. **Language names and icons**: add the map and icon images; confirm the raw URLs display in Discord.
6. **Distribution**: README, `package.json` fields, `.vscodeignore`, build the `.vsix`.

## 14. Open Questions

- **[live test]** Minimum string length Discord accepts (5.1).
- **[live test]** Which activity wins when several windows send with the same Client ID (5.5).
- **[live test]** Whether external image URLs display, and Discord's cache time after an image changes (6.2).
- Webviews, custom editors (image preview, etc.), notebooks, diff editors, and the output panel: idle display, or keep the last file?
- Language of the Discord text and setting descriptions: English only for now. Whether to localize with `package.nls.*.json` and `vscode.l10n`.
- `toggle` writes the user setting; if a workspace setting overrides `enabled`, the toggle has no visible effect.

### Future Candidates

- Linux support (`discord-ipc.md` §1)
- Share the start time across windows (`globalState`)
- Connection state in the status bar
- A setting to hide the activity in specific workspaces
