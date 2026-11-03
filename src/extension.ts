import * as vscode from 'vscode';
import { getClientId } from './config';
import { DiscordIpcClient } from './ipc/discordIpc';
import { PresenceController } from './presence/presenceController';
import { WindowLeader } from './presence/windowLeader';

let client: DiscordIpcClient | undefined;
let controller: PresenceController | undefined;
let windowLeader: WindowLeader | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const logger = vscode.window.createOutputChannel('Discord Presence', { log: true });
	context.subscriptions.push(logger);

	const clientId = getClientId();
	if (!clientId) {
		logger.warn('Client ID is not set. Set DEFAULT_CLIENT_ID in src/config.ts');
		return;
	}

	const presence = new PresenceController(Date.now(), (activity) => ipc.setActivity(activity));
	const ipc = new DiscordIpcClient({ clientId, logger, onReady: () => presence.handleReady() });
	const leader = new WindowLeader(context.globalState, (isLeader) => {
		if (isLeader) {
			logger.info('This window is now the one shown on Discord');
			ipc.start();
		} else {
			logger.info('Another window was focused. Disconnecting');
			void ipc.stop();
		}
	});
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
