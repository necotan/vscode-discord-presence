import * as vscode from 'vscode';
import { getClientId } from './config';
import { DiscordIpcClient } from './ipc/discordIpc';

let client: DiscordIpcClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const logger = vscode.window.createOutputChannel('Discord Presence', { log: true });
	context.subscriptions.push(logger);

	const clientId = getClientId();
	if (!clientId) {
		logger.warn('Client ID is not set. Set DEFAULT_CLIENT_ID in src/config.ts');
		return;
	}

	const startedAt = Date.now();
	const ipc = new DiscordIpcClient({
		clientId,
		logger,
		// マイルストーン1の疎通確認用の固定表示。マイルストーン2で presenceController 経由の送信に置き換える
		onReady: () => ipc.setActivity({ details: 'Connection test', timestamps: { start: startedAt } }),
	});
	ipc.start();
	client = ipc;
}

export async function deactivate(): Promise<void> {
	await client?.stop();
	client = undefined;
}
