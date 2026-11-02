import type { Activity } from '../ipc/discordIpc';

export const ICON_BASE_URL = 'https://raw.githubusercontent.com/necotan/vscode-discord-presence/main/assets/icons';

const VSCODE_ICON = 'vscode';
const VSCODE_NAME = 'Visual Studio Code';
const MAX_TEXT_LENGTH = 128;

export interface LanguageInfo {
	name: string;
	icon?: string;
}

export interface EditorInfo {
	fileName: string;
	language: LanguageInfo;
}

export interface PresenceState {
	idle: boolean;
	editor: EditorInfo | undefined;
	workspaceName: string | undefined;
	startedAt: number;
}

export interface PresenceSettings {
	showFileName: boolean;
	showLanguage: boolean;
	showWorkspace: boolean;
	showElapsedTime: boolean;
}

export function buildActivity(state: PresenceState, settings: PresenceSettings): Activity {
	const activity: Activity = state.idle || !state.editor
		? { details: 'Idling', assets: vscodeAssets() }
		: buildEditingActivity(state.editor, state.workspaceName, settings);
	if (settings.showElapsedTime) {
		activity.timestamps = { start: state.startedAt };
	}
	return activity;
}

function buildEditingActivity(editor: EditorInfo, workspaceName: string | undefined, settings: PresenceSettings): Activity {
	const activity: Activity = {
		details: truncate(settings.showFileName ? `Editing ${editor.fileName}` : 'Editing a file'),
		assets: settings.showLanguage
			? {
				large_image: iconUrl(editor.language.icon ?? VSCODE_ICON),
				large_text: truncate(editor.language.name),
				small_image: iconUrl(VSCODE_ICON),
				small_text: VSCODE_NAME,
			}
			: vscodeAssets(),
	};
	if (settings.showWorkspace && workspaceName) {
		activity.state = truncate(`In ${workspaceName}`);
	}
	return activity;
}

function vscodeAssets(): Activity['assets'] {
	return { large_image: iconUrl(VSCODE_ICON), large_text: VSCODE_NAME };
}

function iconUrl(icon: string): string {
	return `${ICON_BASE_URL}/${icon}.png`;
}

// サロゲートペアを途中で切らないよう、UTF-16 単位ではなくコードポイント単位で数える
export function truncate(text: string): string {
	const chars = Array.from(text);
	return chars.length <= MAX_TEXT_LENGTH ? text : `${chars.slice(0, MAX_TEXT_LENGTH - 1).join('')}…`;
}
