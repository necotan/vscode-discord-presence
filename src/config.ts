import * as vscode from 'vscode';
import type { PresenceSettings } from './presence/activityBuilder';
import { isHiddenWorkspace } from './presence/hiddenWorkspaces';
import { resolveWorkspaceName } from './presence/workspaceName';

export const DEFAULT_CLIENT_ID = '1566793053941923881';

export const CONFIG_SECTION = 'discordPresence';

function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function isEnabled(): boolean {
	return getConfig().get<boolean>('enabled', true);
}

export type ToggleConfig = Pick<vscode.WorkspaceConfiguration, 'get' | 'inspect' | 'update'>;

// ユーザー設定だけを書き換えると、ワークスペース設定で上書きされているときに切り替わらないため、
// 値が書かれているいちばん強い場所を書き換える。書き換えた場所を返す
export async function toggleEnabled(config: ToggleConfig = getConfig()): Promise<vscode.ConfigurationTarget> {
	const target = config.inspect<boolean>('enabled')?.workspaceValue !== undefined
		? vscode.ConfigurationTarget.Workspace
		: vscode.ConfigurationTarget.Global;
	await config.update('enabled', !config.get<boolean>('enabled', true), target);
	return target;
}

export function getClientId(): string {
	const configured = getConfig().get<string>('clientId', '').trim();
	return configured || DEFAULT_CLIENT_ID;
}

export function getIdleTimeoutMs(): number {
	const minutes = getConfig().get<number>('idleTimeoutMinutes', 5);
	return Math.max(0, minutes) * 60_000;
}

export function getWorkspaceName(): string | undefined {
	const { workspaceFile, workspaceFolders } = vscode.workspace;
	return resolveWorkspaceName(workspaceFile, (workspaceFolders ?? []).map((folder) => folder.uri));
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
	const { name: label, workspaceFolders, workspaceFile } = vscode.workspace;
	const paths = (workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
	// 保存前のマルチルートワークスペースは untitled スキームの仮の場所なので、パスとして比べない
	if (workspaceFile && workspaceFile.scheme !== 'untitled') {
		paths.push(workspaceFile.fsPath);
	}
	// ラベルのまま書かれた設定が一致しなくなると、隠していたものが表示されてしまう
	const names = [getWorkspaceName(), label].filter((name): name is string => name !== undefined);
	return isHiddenWorkspace({ names, paths }, entries);
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
