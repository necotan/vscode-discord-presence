import * as path from 'path';
import * as vscode from 'vscode';
import { getIdleTimeoutMs, getPresenceSettings } from '../config';
import type { Activity } from '../ipc/discordIpc';
import { buildActivity, EditorInfo } from './activityBuilder';

// Discord の SET_ACTIVITY は 20 秒に 5 回程度までのため、送信間隔を 4 秒以上空ける
const DEBOUNCE_MS = 1_000;
const THROTTLE_MS = 4_000;

// 出力パネルにフォーカスすると activeTextEditor が output: の URI になり、内部名が表示されてしまうため無視する
const IGNORED_SCHEMES = new Set(['output']);

export class PresenceController implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private debounceTimer: NodeJS.Timeout | undefined;
	private throttleTimer: NodeJS.Timeout | undefined;
	private idleTimer: NodeJS.Timeout | undefined;
	private lastSentJson: string | undefined;
	private lastSentAt = 0;
	private editor: EditorInfo | undefined;
	private idle = false;

	constructor(
		private readonly startedAt: number,
		private readonly sendActivity: (activity: Activity) => boolean,
	) {
		this.updateEditor(vscode.window.activeTextEditor);
		if (!vscode.window.state.focused) {
			this.startIdleTimer();
		}
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => this.handleEditorChange(editor)),
			vscode.window.onDidChangeWindowState((state) => this.handleWindowState(state)),
		);
	}

	// 再接続後は Discord 側の表示が消えているため、前回と同じ内容でも送り直す
	handleReady(): void {
		this.resend();
	}

	dispose(): void {
		this.clearDebounceTimer();
		this.clearIdleTimer();
		if (this.throttleTimer) {
			clearTimeout(this.throttleTimer);
			this.throttleTimer = undefined;
		}
		vscode.Disposable.from(...this.disposables).dispose();
	}

	private handleEditorChange(editor: vscode.TextEditor | undefined): void {
		if (!this.updateEditor(editor)) {
			return;
		}
		if (editor) {
			this.idle = false;
			if (!vscode.window.state.focused) {
				this.startIdleTimer();
			}
		}
		this.requestUpdate();
	}

	private handleWindowState(state: vscode.WindowState): void {
		if (state.focused) {
			this.clearIdleTimer();
			this.idle = false;
			// 他のウィンドウの表示で上書きされている可能性があるため、前回と同じ内容でも送り直す
			this.resend();
		} else {
			this.startIdleTimer();
		}
	}

	// 無視するエディタでは直前のファイルの表示を残し、更新が不要なことを false で返す
	private updateEditor(editor: vscode.TextEditor | undefined): boolean {
		if (!editor) {
			this.editor = undefined;
			return true;
		}
		const { uri, languageId } = editor.document;
		if (IGNORED_SCHEMES.has(uri.scheme)) {
			return false;
		}
		this.editor = {
			// fsPath ではなく uri.path を使い、untitled やリモートのファイルでも同じ方法で名前を取る
			fileName: path.posix.basename(uri.path),
			language: { name: languageId },
		};
		return true;
	}

	private startIdleTimer(): void {
		this.clearIdleTimer();
		this.idleTimer = setTimeout(() => {
			this.idleTimer = undefined;
			this.idle = true;
			this.sendThrottled();
		}, getIdleTimeoutMs());
	}

	private resend(): void {
		this.lastSentJson = undefined;
		this.clearDebounceTimer();
		this.sendThrottled();
	}

	private requestUpdate(): void {
		this.clearDebounceTimer();
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = undefined;
			this.sendThrottled();
		}, DEBOUNCE_MS);
	}

	// 待機中に来た更新は、送信時に最新の状態から組み立て直すので最後の 1 件だけが送られる
	private sendThrottled(): void {
		if (this.throttleTimer) {
			return;
		}
		const wait = this.lastSentAt + THROTTLE_MS - Date.now();
		if (wait <= 0) {
			this.send();
			return;
		}
		this.throttleTimer = setTimeout(() => {
			this.throttleTimer = undefined;
			this.send();
		}, wait);
	}

	private send(): void {
		const activity = buildActivity(
			{
				idle: this.idle,
				editor: this.editor,
				workspaceName: vscode.workspace.name,
				startedAt: this.startedAt,
			},
			getPresenceSettings(),
		);
		const json = JSON.stringify(activity);
		if (json === this.lastSentJson) {
			return;
		}
		if (this.sendActivity(activity)) {
			this.lastSentJson = json;
			this.lastSentAt = Date.now();
		}
	}

	private clearDebounceTimer(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}
	}

	private clearIdleTimer(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = undefined;
		}
	}
}
