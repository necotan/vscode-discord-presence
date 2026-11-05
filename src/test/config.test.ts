import * as assert from 'assert';
import * as vscode from 'vscode';
import { toggleEnabled, ToggleConfig } from '../config';

interface Write {
	section: string;
	value: unknown;
	target: vscode.ConfigurationTarget | boolean | null | undefined;
}

class FakeConfig implements ToggleConfig {
	readonly writes: Write[] = [];

	constructor(
		private readonly effectiveValue: unknown,
		private readonly workspaceValue: unknown,
	) {}

	get<T>(section: string): T | undefined;
	get<T>(section: string, defaultValue: T): T;
	get<T>(_section: string, defaultValue?: T): T | undefined {
		return this.effectiveValue === undefined ? defaultValue : this.effectiveValue as T;
	}

	inspect<T>(key: string): { key: string; workspaceValue?: T } {
		return { key, workspaceValue: this.workspaceValue as T | undefined };
	}

	async update(section: string, value: unknown, target?: vscode.ConfigurationTarget | boolean | null): Promise<void> {
		this.writes.push({ section, value, target });
	}
}

suite('config', () => {
	test('toggleEnabled writes to the user settings without a workspace value', async () => {
		const config = new FakeConfig(true, undefined);
		assert.strictEqual(await toggleEnabled(config), vscode.ConfigurationTarget.Global);
		assert.deepStrictEqual(config.writes, [{ section: 'enabled', value: false, target: vscode.ConfigurationTarget.Global }]);
	});

	test('toggleEnabled writes to the workspace settings when they set the value', async () => {
		const config = new FakeConfig(true, true);
		assert.strictEqual(await toggleEnabled(config), vscode.ConfigurationTarget.Workspace);
		assert.deepStrictEqual(config.writes, [{ section: 'enabled', value: false, target: vscode.ConfigurationTarget.Workspace }]);
	});

	test('toggleEnabled treats a workspace value of false as set', async () => {
		const config = new FakeConfig(false, false);
		assert.strictEqual(await toggleEnabled(config), vscode.ConfigurationTarget.Workspace);
		assert.deepStrictEqual(config.writes, [{ section: 'enabled', value: true, target: vscode.ConfigurationTarget.Workspace }]);
	});

	test('toggleEnabled turns off when nothing is set, because the default is on', async () => {
		const config = new FakeConfig(undefined, undefined);
		await toggleEnabled(config);
		assert.deepStrictEqual(config.writes, [{ section: 'enabled', value: false, target: vscode.ConfigurationTarget.Global }]);
	});
});
