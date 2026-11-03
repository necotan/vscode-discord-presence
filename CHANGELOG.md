# Changelog

## [0.1.0] - 2026-11-03

First release.

- Shows the active file name, language (with icon), workspace name, and elapsed time on Discord.
- Switches to `Idling` when no file is open, or after VS Code has lost focus for `idleTimeoutMinutes`.
- With several windows, only the last focused window connects to Discord.
- Settings: `enabled`, `clientId`, `showFileName`, `showLanguage`, `showWorkspace`, `idleTimeoutMinutes`.
- Commands: **Discord Presence: Reconnect**, **Discord Presence: Toggle**.
