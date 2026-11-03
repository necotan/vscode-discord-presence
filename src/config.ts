import * as vscode from 'vscode';
import type { PresenceSettings } from './presence/activityBuilder';

export const DEFAULT_CLIENT_ID = '1566793053941923881';

export function getClientId(): string {
	const configured = vscode.workspace.getConfiguration('discordPresence').get<string>('clientId', '').trim();
	return configured || DEFAULT_CLIENT_ID;
}

export function getIdleTimeoutMs(): number {
	const minutes = vscode.workspace.getConfiguration('discordPresence').get<number>('idleTimeoutMinutes', 5);
	return Math.max(0, minutes) * 60_000;
}

export function getPresenceSettings(): PresenceSettings {
	const config = vscode.workspace.getConfiguration('discordPresence');
	return {
		showFileName: config.get<boolean>('showFileName', true),
		showLanguage: config.get<boolean>('showLanguage', true),
		showWorkspace: config.get<boolean>('showWorkspace', true),
		showElapsedTime: config.get<boolean>('showElapsedTime', true),
	};
}
