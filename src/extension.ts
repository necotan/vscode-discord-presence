import * as vscode from 'vscode';
import { CONFIG_SECTION, getClientId, isEnabled, toggleEnabled } from './config';
import { DiscordIpcClient } from './ipc/discordIpc';
import { PresenceController } from './presence/presenceController';
import { WindowLeader } from './presence/windowLeader';

let client: DiscordIpcClient | undefined;
let controller: PresenceController | undefined;
let windowLeader: WindowLeader | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const logger = vscode.window.createOutputChannel('Discord Presence', { log: true });
	context.subscriptions.push(logger);

	let isLeader = false;
	const presence = new PresenceController(Date.now(), (activity) => ipc.setActivity(activity));
	const ipc = new DiscordIpcClient({ clientId: getClientId(), logger, onReady: () => presence.handleReady() });

	const updateConnection = (): void => {
		if (isEnabled() && isLeader) {
			ipc.start();
		} else {
			void ipc.stop();
		}
	};

	const leader = new WindowLeader(context.globalState, (leaderNow) => {
		isLeader = leaderNow;
		logger.info(leaderNow ? 'This window is now the one shown on Discord' : 'Another window was focused. Disconnecting');
		updateConnection();
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${CONFIG_SECTION}.enabled`)) {
				logger.info(isEnabled() ? 'Enabled' : 'Disabled');
				updateConnection();
			}
			if (event.affectsConfiguration(`${CONFIG_SECTION}.clientId`)) {
				ipc.setClientId(getClientId());
			}
		}),
		vscode.commands.registerCommand('discordPresence.reconnect', () => {
			if (isEnabled() && isLeader) {
				logger.info('Reconnecting');
				ipc.reconnect();
			} else {
				logger.info('Not reconnecting: disabled, or another window is shown on Discord');
			}
		}),
		vscode.commands.registerCommand('discordPresence.toggle', async () => {
			try {
				await toggleEnabled();
			} catch (error) {
				logger.error(`Failed to toggle: ${String(error)}`);
			}
		}),
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
