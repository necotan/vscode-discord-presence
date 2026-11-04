import type { IpcState } from '../ipc/discordIpc';

export type ConnectionStatus = 'disabled' | 'hidden' | 'otherWindow' | 'connecting' | 'waiting' | 'connected';

export interface StatusInput {
	enabled: boolean;
	hiddenMode: 'hide' | 'mask' | undefined;
	leader: boolean;
	ipc: IpcState;
}

export interface StatusView {
	text: string;
	tooltip: string;
}

// 表示されない理由のうち、ユーザーが自分で変えられるものを先に出す
export function resolveStatus(input: StatusInput): ConnectionStatus {
	if (!input.enabled) {
		return 'disabled';
	}
	if (input.hiddenMode === 'hide') {
		return 'hidden';
	}
	if (!input.leader) {
		return 'otherWindow';
	}
	// 接続役で stopped になるのは start が呼ばれる直前だけ
	return input.ipc === 'stopped' ? 'connecting' : input.ipc;
}

const VIEWS: Record<ConnectionStatus, { icon: string; message: string }> = {
	disabled: { icon: 'circle-slash', message: 'Discord Presence is off.' },
	hidden: { icon: 'eye-closed', message: 'Hidden in this workspace (discordPresence.hiddenWorkspaces).' },
	otherWindow: { icon: 'window', message: 'Another VS Code window is shown on Discord.' },
	connecting: { icon: 'sync~spin', message: 'Connecting to Discord...' },
	waiting: { icon: 'debug-disconnect', message: 'Not connected to Discord. Retrying every 15 s.' },
	connected: { icon: 'broadcast', message: 'Shown on Discord.' },
};

export function describeStatus(status: ConnectionStatus, masked: boolean): StatusView {
	const { icon, message } = VIEWS[status];
	const detail = status === 'connected' && masked ? 'Shown on Discord, masked in this workspace.' : message;
	return {
		text: `$(${icon}) Discord`,
		tooltip: `Discord Presence\n${detail}\nClick for actions.`,
	};
}
