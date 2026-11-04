# Changelog

## [0.3.0] - 2026-11-04

- Added a status bar item that shows whether this window is shown on Discord, with a menu to turn it off or on, reconnect, show the log, or open the settings.
- Added the **Discord Presence: Show Log** command.
- Fixed **Discord Presence: Toggle** doing nothing when `discordPresence.enabled` is set in the workspace settings. It now switches the workspace setting.

## [0.2.0] - 2026-11-04

- Added `hiddenWorkspaces` and `hiddenWorkspaceMode` to hide the activity, or show only "Editing a file", in chosen workspaces.
- Added `showVSCodeLogo` to hide the small VS Code logo in the corner of the language icon.
- Clarified that `clientId` changes the name shown after "Playing", and added the steps to the README.

## [0.1.0] - 2026-11-03

First release.

- Shows the active file name, language (with icon), workspace name, and elapsed time on Discord.
- Switches to `Idling` when no file is open, or after VS Code has lost focus for `idleTimeoutMinutes`.
- With several windows, only the last focused window connects to Discord.
- Settings: `enabled`, `clientId`, `showFileName`, `showLanguage`, `showWorkspace`, `idleTimeoutMinutes`.
- Commands: **Discord Presence: Reconnect**, **Discord Presence: Toggle**.
