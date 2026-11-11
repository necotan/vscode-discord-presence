# CLAUDE.md

## Language rules

- Respond to the user in Japanese.
- Commit messages: first line in English, all following lines in Japanese.
- Write code comments in Japanese.
- Use English for variable names, function names, file names, setting keys, and command IDs.

## Project

vscode-discord-presence: a VS Code extension that shows the current file, language (with icon), workspace, and elapsed time as a Discord activity (Rich Presence). For the author and friends; distributed as a `.vsix`, not published to the Marketplace.

The specs are the source of truth for what to build; read the relevant section before implementing. This file covers how to work. If a change would contradict a spec, ask first.

- `docs/requirements.md`: display rules, idle and multi-window behavior, settings, commands, error handling, milestones, open questions. Read it when changing what the user or their Discord friends see.
- `docs/discord-ipc.md`: named pipe path, frame format, handshake, `SET_ACTIVITY` payload, rate limiting, reconnect. Read it before touching `src/ipc/` or the activity object.

## Commands

- `npm run compile`: build with `tsc` into `out/` (also the type check)
- `npm run watch`: incremental build (default build task)
- `npm run lint`: ESLint (warnings fail too), then `scripts/checkManifest.mjs`
- `npm test`: unit tests in the extension host via `@vscode/test-cli` (runs `compile` and `lint` first; downloads VS Code into `.vscode-test/` on the first run)
- `npx @vscode/vsce@4.0.0 package`: build the `.vsix` (version pinned; see `docs/requirements.md` §3)
- `npm run generate:icons`: regenerate `assets/icons/*.png` from devicon (needs Chrome or Edge, and network access)
- Manual testing: F5 in VS Code (Extension Development Host). The Discord desktop app must be running.

## After every change

- Run `npm run lint` and `npm run compile`; the git `pre-commit` hook runs both. They enforce the import, network, platform, and privacy rules marked "ESLint" below. `scripts/checkManifest.mjs` fails when `package.json` (`dependencies`, `extensionKind`, settings, commands) disagrees with `src/`, `assets/icons/`, both READMEs, or `docs/requirements.md`.
- If a file that has a test in `src/test/` changed, run `npm test`.
- If an `icon` was added to `src/languages.ts`, run `npm run generate:icons` and commit the new PNG.
- If settings or commands changed, update the descriptions in `docs/requirements.md` §7–8 and both READMEs; the script checks only that each key and command title appears.

## Layout

- `src/extension.ts`: `activate` / `deactivate`; wires the modules together only.
- `src/statusBar.ts`: the status bar item and its menu.
- `src/config.ts`: reads settings; holds `DEFAULT_CLIENT_ID`. `ICON_BASE_URL` is in `activityBuilder.ts`, which must not import `config.ts` (it imports `vscode`).
- `src/languages.ts`: `languageId` → display name and icon name.
- `src/ipc/`: Discord IPC client (`getIpcPath.ts`, `frame.ts`, `discordIpc.ts`).
- `src/presence/`: `activityBuilder.ts` (pure), `connectionStatus.ts` (pure, status bar state and text), `hiddenWorkspaces.ts` (pure, `hiddenWorkspaces` matching), `workspaceName.ts` (pure, the workspace name sent to Discord), `presenceController.ts` (VS Code events, idle, throttling), and `windowLeader.ts` (only the last focused window connects).
- `src/test/`: unit tests; `fakeDiscord.ts` is a fake Discord IPC server for them. `assets/icons/`: generated icon PNGs served to Discord from GitHub raw URLs; do not edit by hand. `scripts/generateIcons.mjs`: builds them.
- `.githooks/`: `pre-commit` (lint, compile) and `commit-msg` (line 1 format). Enable once per clone: `git config core.hooksPath .githooks`.
- `.claude/`: Claude Code settings (denied git commands) and the Stop hook that runs lint and compile.
- `scripts/checkManifest.mjs`: the consistency check run by `npm run lint`.
- `.github/workflows/ci.yml`: runs `npm test` on Windows for each pull request and each push to `main`.
- `out/`, `.vscode-test/`, `*.vsix`: generated and git-ignored. Do not edit.
- `docs/`: only the two specs are tracked; anything else there is git-ignored local notes. When behavior or the protocol handling changes, update the spec in the same change.
- Module responsibilities in detail: `docs/requirements.md` §10.

## Rules

### Stack

- Runtime `dependencies` MUST stay empty. Talk to Discord with Node.js built-ins (`net`) only. NEVER add `discord-rpc`, `@xhayper/discord-rpc`, or similar.
- Ask first before adding a devDependency, a bundler, or changing the build.
- TypeScript strict. Do not use `any` or omit type definitions (ESLint).

### Platform

- Windows only for now. Keep every OS-specific decision (the pipe path) inside `src/ipc/getIpcPath.ts`, so Linux support touches only that file. ESLint rejects `process.platform` elsewhere.
- Keep `"extensionKind": ["ui"]` in `package.json`. The extension must run on the local machine during Remote-SSH and WSL, where Discord is.

### Purity and tests

- `activityBuilder.ts`, `connectionStatus.ts`, `hiddenWorkspaces.ts`, `workspaceName.ts`, `frame.ts`, and `languages.ts` MUST NOT import `vscode` or `config.ts` (ESLint; the file list is in `eslint.config.mjs`). They take plain values and return plain values, so they can be unit tested.
- Add or update unit tests when changing them.

### Discord

- Every activity update goes through the debounce and throttle in `presenceController.ts` (`docs/discord-ipc.md` §6). NEVER call `SET_ACTIVITY` directly from an event handler. Discord limits it to about 5 updates per 20 s. ESLint rejects `setActivity()` calls outside the wiring in `extension.ts`.
- Discord not running or disconnecting is a normal state. NEVER let a connection error throw out of a handler or crash the extension, and do not show error notifications for it. Log to the output channel and wait for the reconnect. ESLint rejects `showErrorMessage` / `showWarningMessage` and unhandled promises.
- NEVER put a Client Secret or bot token in the code. Rich Presence needs only the Client ID, which is public and may be embedded.

### Privacy

- Send only what `docs/requirements.md` §4 lists: file base name, language name, workspace name, start time. NEVER send full paths, file contents, Git information, or anything else. ESLint rejects `fsPath` outside `config.ts` and `getText()`, but does not check what is sent.
- The extension itself makes no network requests. Icons are fetched by Discord from GitHub, not by the extension. ESLint rejects `fetch` and the network modules; `net` is allowed only in `src/ipc/discordIpc.ts` and tests.

### Live tests and milestones

- Specs mark behavior that depends on the Discord client with **[live test]**. Do not assert how it behaves; give the user concrete test steps and wait for the result, then record it in the spec.
- Work milestone by milestone (`docs/requirements.md` §13). At the end of each one, give the user the manual test steps and wait for confirmation before starting the next.

### Comments

- Write only why: the reason for a choice, workarounds for VS Code API or Discord client quirks, and protocol constraints the code alone does not show.
- Do not write what the code or names already say (e.g. "接続処理", "設定を読み込む", "〜の関数"). If there is no why to explain, write no comment.
- No decorative characters such as `---`, `===`, `***`.

## Git workflow

- Do not run `git checkout -b`, `commit`, `push`, PR creation, `merge`, or `pull`. The user runs them.
- At the start of work, propose a branch name (`feature/xxx` or `fix/xxx`). Say no branch is needed only when the change is docs or text only and small enough to review the diff by eye.
- After code changes, run `git status` and `git diff` (plus `git diff --staged` if anything is staged), then propose a commit message based on the actual diff.

## Commit messages

| Prefix | Use |
|---|---|
| fix | Bug fix |
| hotfix | Critical bug fix |
| add | New file or feature |
| update | Feature change (not a bug) |
| change | Spec change |
| clean | Cleanup, refactoring |
| disable | Disable, comment out |
| remove | Remove a file or feature |
| upgrade | Version upgrade |
| revert | Revert a change |

- Line 1: `<prefix>: <summary in English>`.
- The body is optional. For a small change that line 1 fully describes, write line 1 only. Otherwise add a blank line and 1 to about 4 Japanese bullets; do not pad to reach 4.
- Bullets name the concrete files, functions, settings, or commands changed and how. Do not explain causes or background unless the user asks.

```
fix: typo in reconnect command title
```

```
add: Discord IPC handshake and fixed test activity

- src/ipc/getIpcPath.ts を追加し、discord-ipc-0〜9 を順に返す
- src/ipc/frame.ts にフレームのエンコードと分割受信対応のデコーダを追加
- src/ipc/discordIpc.ts でハンドシェイクと READY 待ち、SET_ACTIVITY 送信を実装
- package.json の activationEvents を onStartupFinished に変更し、extensionKind を追加
```
