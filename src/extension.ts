import * as vscode from 'vscode';
import { CONFIG_SECTION, getClientId, getHiddenMatch, isEnabled, shouldConnect, toggleEnabled } from './config';
import { DiscordIpcClient, IpcState } from './ipc/discordIpc';
import { resolveStatus } from './presence/connectionStatus';
import { PresenceController } from './presence/presenceController';
import { WindowLeader } from './presence/windowLeader';
import { SHOW_MENU_COMMAND, showStatusMenu, StatusBar } from './statusBar';

let client: DiscordIpcClient | undefined;
let controller: PresenceController | undefined;
let windowLeader: WindowLeader | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const logger = vscode.window.createOutputChannel('Discord Presence', { log: true });
	const statusBar = new StatusBar();
	context.subscriptions.push(logger, statusBar);

	let isLeader = false;
	let ipcState: IpcState = 'stopped';
	const refreshStatus = (): void => {
		const hiddenMode = getHiddenMatch();
		statusBar.update(resolveStatus({ enabled: isEnabled(), hiddenMode, leader: isLeader, ipc: ipcState }), hiddenMode === 'mask');
	};

	const presence = new PresenceController(Date.now(), (activity) => ipc.setActivity(activity));
	const ipc = new DiscordIpcClient({
		clientId: getClientId(),
		logger,
		onReady: () => presence.handleReady(),
		onStateChange: (state) => {
			ipcState = state;
			refreshStatus();
		},
	});

	const updateConnection = (): void => {
		if (isLeader && shouldConnect()) {
			ipc.start();
		} else {
			if (isLeader && isEnabled()) {
				logger.info('Not connecting: this workspace is in discordPresence.hiddenWorkspaces');
			}
			void ipc.stop();
		}
		refreshStatus();
	};

	const leader = new WindowLeader(context.globalState, (leaderNow) => {
		isLeader = leaderNow;
		logger.info(leaderNow ? 'This window is now the one shown on Discord' : 'Another window was focused. Disconnecting');
		updateConnection();
	});
	refreshStatus();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${CONFIG_SECTION}.enabled`)) {
				logger.info(isEnabled() ? 'Enabled' : 'Disabled');
				updateConnection();
			}
			if (event.affectsConfiguration(`${CONFIG_SECTION}.clientId`)) {
				ipc.setClientId(getClientId());
			}
			if (event.affectsConfiguration(`${CONFIG_SECTION}.hiddenWorkspaces`)
				|| event.affectsConfiguration(`${CONFIG_SECTION}.hiddenWorkspaceMode`)) {
				updateConnection();
			}
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(() => updateConnection()),
		vscode.commands.registerCommand('discordPresence.reconnect', () => {
			if (isLeader && shouldConnect()) {
				logger.info('Reconnecting');
				ipc.reconnect();
			} else {
				logger.info('Not reconnecting: disabled, hidden in this workspace, or another window is shown on Discord');
			}
		}),
		vscode.commands.registerCommand('discordPresence.toggle', async () => {
			try {
				await toggleEnabled();
			} catch (error) {
				logger.error(`Failed to toggle: ${String(error)}`);
			}
		}),
		vscode.commands.registerCommand('discordPresence.showLog', () => logger.show()),
		vscode.commands.registerCommand(SHOW_MENU_COMMAND, () => showStatusMenu(isEnabled(), context.extension.id)),
	);

	controller = presence;
	client = ipc;
	windowLeader = leader;
}

export async function deactivate(): Promise<void> {
	windowLeader?.dispose();
	windowLeader = undefined;
	controller?.dispose();
	controller = undefined;
	await client?.stop();
	client = undefined;
}
