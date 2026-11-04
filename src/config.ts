import * as vscode from 'vscode';
import type { PresenceSettings } from './presence/activityBuilder';
import { isHiddenWorkspace } from './presence/hiddenWorkspaces';

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
	const masked = getHiddenMatch() === 'mask';
	return {
		showFileName: !masked && config.get<boolean>('showFileName', true),
		showLanguage: !masked && config.get<boolean>('showLanguage', true),
		showVSCodeLogo: config.get<boolean>('showVSCodeLogo', true),
		showWorkspace: !masked && config.get<boolean>('showWorkspace', true),
	};
}

export type HiddenWorkspaceMode = 'hide' | 'mask';

// 不正な値は、何も送らない側に倒す
export function getHiddenWorkspaceMode(): HiddenWorkspaceMode {
	return getConfig().get<string>('hiddenWorkspaceMode') === 'mask' ? 'mask' : 'hide';
}

export function isCurrentWorkspaceHidden(): boolean {
	const configured = getConfig().get<unknown>('hiddenWorkspaces', []);
	const entries = Array.isArray(configured)
		? configured.filter((entry): entry is string => typeof entry === 'string')
		: [];
	if (entries.length === 0) {
		return false;
	}
	const { name, workspaceFolders, workspaceFile } = vscode.workspace;
	const paths = (workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
	// 保存前のマルチルートワークスペースは untitled スキームの仮の場所なので、パスとして比べない
	if (workspaceFile && workspaceFile.scheme !== 'untitled') {
		paths.push(workspaceFile.fsPath);
	}
	return isHiddenWorkspace({ name, paths }, entries);
}

export function getHiddenMatch(): HiddenWorkspaceMode | undefined {
	return isCurrentWorkspaceHidden() ? getHiddenWorkspaceMode() : undefined;
}

// hide のときは接続しないことで、ほかのウィンドウの表示も残さない（requirements.md §5.6）
export function isHiddenByHideMode(): boolean {
	return getHiddenMatch() === 'hide';
}

export function shouldConnect(): boolean {
	return isEnabled() && !isHiddenByHideMode();
}
