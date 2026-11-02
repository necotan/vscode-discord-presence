import * as vscode from 'vscode';
import { getClientId } from './config';
import { DiscordIpcClient } from './ipc/discordIpc';
import { PresenceController } from './presence/presenceController';

let client: DiscordIpcClient | undefined;
let controller: PresenceController | undefined;

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
	ipc.start();
	controller = presence;
	client = ipc;
}

export async function deactivate(): Promise<void> {
	controller?.dispose();
	controller = undefined;
	await client?.stop();
	client = undefined;
}
