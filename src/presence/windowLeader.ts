import { randomUUID } from 'crypto';
import * as vscode from 'vscode';

// Discord は同じ Client ID の接続が複数あると先に接続した方の表示しか出さないため、
// 最後にフォーカスしたウィンドウだけが接続する。どのウィンドウかは globalState で共有する
const LEADER_KEY = 'leaderWindowId';
const POLL_MS = 1_000;
// 前のウィンドウが POLL_MS ごとの確認で接続を切るのを待ってから接続する
const HANDOVER_DELAY_MS = 1_500;

// フォーカスのイベントはテストから発火できず、待ち時間も長いため差し替えられるようにする
export interface WindowLeaderOptions {
	focus?: Pick<typeof vscode.window, 'state' | 'onDidChangeWindowState'>;
	pollMs?: number;
	handoverDelayMs?: number;
}

export class WindowLeader implements vscode.Disposable {
	private readonly id = randomUUID();
	private readonly subscription: vscode.Disposable;
	private readonly pollTimer: NodeJS.Timeout;
	private readonly handoverDelayMs: number;
	private claimTimer: NodeJS.Timeout | undefined;
	private leader = false;

	constructor(
		private readonly state: vscode.Memento,
		private readonly onChange: (leader: boolean) => void,
		options: WindowLeaderOptions = {},
	) {
		const focus = options.focus ?? vscode.window;
		this.handoverDelayMs = options.handoverDelayMs ?? HANDOVER_DELAY_MS;
		this.subscription = focus.onDidChangeWindowState((windowState) => {
			if (windowState.focused) {
				this.claim();
			}
		});
		this.pollTimer = setInterval(() => this.check(), options.pollMs ?? POLL_MS);
		if (focus.state.focused) {
			this.claim();
		}
	}

	dispose(): void {
		this.subscription.dispose();
		clearInterval(this.pollTimer);
		if (this.claimTimer) {
			clearTimeout(this.claimTimer);
			this.claimTimer = undefined;
		}
	}

	private claim(): void {
		void this.state.update(LEADER_KEY, this.id);
		if (this.leader || this.claimTimer) {
			return;
		}
		this.claimTimer = setTimeout(() => {
			this.claimTimer = undefined;
			if (this.isCurrentLeader()) {
				this.setLeader(true);
			}
		}, this.handoverDelayMs);
	}

	private check(): void {
		if (this.leader && !this.isCurrentLeader()) {
			this.setLeader(false);
		}
	}

	private isCurrentLeader(): boolean {
		return this.state.get<string>(LEADER_KEY) === this.id;
	}

	private setLeader(leader: boolean): void {
		this.leader = leader;
		this.onChange(leader);
	}
}
