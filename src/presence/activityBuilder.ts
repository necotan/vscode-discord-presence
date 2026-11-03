import type { Activity } from '../ipc/discordIpc';

export const ICON_BASE_URL = 'https://raw.githubusercontent.com/necotan/vscode-discord-presence/main/assets/icons';

const VSCODE_ICON = 'vscode';
const VSCODE_NAME = 'Visual Studio Code';
const MAX_TEXT_LENGTH = 128;
const MIN_TEXT_LENGTH = 2;
// 見た目を変えずに最小文字数を満たすため、ゼロ幅スペースで埋める
const PADDING = '\u200b';

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
}

export function buildActivity(state: PresenceState, settings: PresenceSettings): Activity {
	const activity: Activity = state.idle || !state.editor
		? { details: 'Idling', assets: vscodeAssets() }
		: buildEditingActivity(state.editor, state.workspaceName, settings);
	// timestamps を省いても Discord が独自に経過時間を数えて表示するため、隠す設定は設けず常に送る
	return { ...activity, timestamps: { start: state.startedAt } };
}

function buildEditingActivity(editor: EditorInfo, workspaceName: string | undefined, settings: PresenceSettings): Activity {
	const activity: Activity = {
		details: fitText(settings.showFileName ? `Editing ${editor.fileName}` : 'Editing a file'),
		assets: settings.showLanguage
			? {
				large_image: iconUrl(editor.language.icon ?? VSCODE_ICON),
				large_text: fitText(editor.language.name),
				small_image: iconUrl(VSCODE_ICON),
				small_text: VSCODE_NAME,
			}
			: vscodeAssets(),
	};
	if (settings.showWorkspace && workspaceName) {
		activity.state = fitText(`In ${workspaceName}`);
	}
	return activity;
}

function vscodeAssets(): Activity['assets'] {
	return { large_image: iconUrl(VSCODE_ICON), large_text: VSCODE_NAME };
}

function iconUrl(icon: string): string {
	return `${ICON_BASE_URL}/${icon}.png`;
}

// Discord は 2 文字未満の文字列を拒否してアクティビティ全体を更新しない（言語名 C や R で確認）。
// 最小文字数は UTF-16 単位で判定されるため length で比べ、最大文字数はサロゲートペアを途中で切らないようコードポイント単位で数える
export function fitText(text: string): string {
	if (text.length < MIN_TEXT_LENGTH) {
		return text.padEnd(MIN_TEXT_LENGTH, PADDING);
	}
	const chars = Array.from(text);
	return chars.length <= MAX_TEXT_LENGTH ? text : `${chars.slice(0, MAX_TEXT_LENGTH - 1).join('')}…`;
}
