import * as vscode from 'vscode';
import { describeStatus, ConnectionStatus } from './presence/connectionStatus';

export const SHOW_MENU_COMMAND = 'discordPresence.showMenu';

export class StatusBar implements vscode.Disposable {
	// ID と name を付けると、VS Code 標準の右クリックメニューからこの項目だけを非表示にできる
	private readonly item = vscode.window.createStatusBarItem('discordPresence.status', vscode.StatusBarAlignment.Right);

	constructor() {
		this.item.name = 'Discord Presence';
		this.item.command = SHOW_MENU_COMMAND;
		this.item.show();
	}

	update(status: ConnectionStatus, masked: boolean): void {
		const view = describeStatus(status, masked);
		this.item.text = view.text;
		this.item.tooltip = view.tooltip;
	}

	dispose(): void {
		this.item.dispose();
	}
}

interface MenuItem extends vscode.QuickPickItem {
	run: () => Thenable<unknown>;
}

export async function showStatusMenu(enabled: boolean, extensionId: string): Promise<void> {
	const items: MenuItem[] = [
		enabled
			? { label: '$(circle-slash) Turn Off', run: () => vscode.commands.executeCommand('discordPresence.toggle') }
			: { label: '$(broadcast) Turn On', run: () => vscode.commands.executeCommand('discordPresence.toggle') },
		{ label: '$(refresh) Reconnect', run: () => vscode.commands.executeCommand('discordPresence.reconnect') },
		{ label: '$(output) Show Log', run: () => vscode.commands.executeCommand('discordPresence.showLog') },
		{
			label: '$(gear) Open Settings',
			run: () => vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${extensionId}`),
		},
	];
	const picked = await vscode.window.showQuickPick(items, { title: 'Discord Presence' });
	await picked?.run();
}
