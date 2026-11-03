import * as vscode from 'vscode';
import type { PresenceSettings } from './presence/activityBuilder';

export const DEFAULT_CLIENT_ID = '1566793053941923881';

export const CONFIG_SECTION = 'discordPresence';

function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function isEnabled(): boolean {
	return getConfig().get<boolean>('enabled', true);
}

// ワークスペース設定で上書きされている場合は効かない（requirements.md §14）
export async function toggleEnabled(): Promise<void> {
	await getConfig().update('enabled', !isEnabled(), vscode.ConfigurationTarget.Global);
}

export function getClientId(): string {
	const configured = getConfig().get<string>('clientId', '').trim();
	return configured || DEFAULT_CLIENT_ID;
}

export function getIdleTimeoutMs(): number {
	const minutes = getConfig().get<number>('idleTimeoutMinutes', 5);
	return Math.max(0, minutes) * 60_000;
}

export function getPresenceSettings(): PresenceSettings {
	const config = getConfig();
	return {
		showFileName: config.get<boolean>('showFileName', true),
		showLanguage: config.get<boolean>('showLanguage', true),
		showWorkspace: config.get<boolean>('showWorkspace', true),
	};
}
