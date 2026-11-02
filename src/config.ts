import * as vscode from 'vscode';

// Discord Developer Portal で登録したアプリケーションの Application ID。公開情報なので埋め込んでよい
export const DEFAULT_CLIENT_ID = '1566793053941923881';

export function getClientId(): string {
	const configured = vscode.workspace.getConfiguration('discordPresence').get<string>('clientId', '').trim();
	return configured || DEFAULT_CLIENT_ID;
}
