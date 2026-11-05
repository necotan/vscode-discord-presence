import * as assert from 'assert';
import * as vscode from 'vscode';
import { WindowLeader } from '../presence/windowLeader';
import { delay, waitUntil } from './fakeDiscord';

const POLL_MS = 10;
const HANDOVER_DELAY_MS = 40;

class FakeMemento implements vscode.Memento {
	private readonly values = new Map<string, unknown>();

	keys(): readonly string[] {
		return [...this.values.keys()];
	}

	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}

	async update(key: string, value: unknown): Promise<void> {
		this.values.set(key, value);
	}
}

class FakeWindow implements vscode.Disposable {
	state: vscode.WindowState;
	private readonly emitter = new vscode.EventEmitter<vscode.WindowState>();
	readonly onDidChangeWindowState = this.emitter.event;

	constructor(focused: boolean) {
		this.state = { focused, active: focused };
	}

	setFocused(focused: boolean): void {
		this.state = { focused, active: focused };
		this.emitter.fire(this.state);
	}

	dispose(): void {
		this.emitter.dispose();
	}
}

suite('windowLeader', () => {
	let memento: FakeMemento;
	let log: string[];
	let disposables: vscode.Disposable[];

	function openWindow(name: string, focused: boolean): { window: FakeWindow; leader: WindowLeader } {
		const window = new FakeWindow(focused);
		const leader = new WindowLeader(memento, (isLeader) => log.push(`${name}:${isLeader}`), {
			focus: window,
			pollMs: POLL_MS,
			handoverDelayMs: HANDOVER_DELAY_MS,
		});
		disposables.push(leader, window);
		return { window, leader };
	}

	setup(() => {
		memento = new FakeMemento();
		log = [];
		disposables = [];
	});

	teardown(() => {
		vscode.Disposable.from(...disposables).dispose();
	});

	test('takes the role after the handover delay when focused at startup', async () => {
		openWindow('a', true);
		assert.deepStrictEqual(log, []);
		await waitUntil(() => log.length === 1);
		assert.deepStrictEqual(log, ['a:true']);
	});

	test('does not take the role until the window is focused', async () => {
		const { window } = openWindow('a', false);
		await delay(HANDOVER_DELAY_MS * 2);
		assert.deepStrictEqual(log, []);
		window.setFocused(true);
		await waitUntil(() => log.length === 1);
		assert.deepStrictEqual(log, ['a:true']);
	});

	test('gives way when another window claims during the handover delay', async () => {
		openWindow('a', true);
		openWindow('b', true);
		await waitUntil(() => log.length === 1);
		await delay(HANDOVER_DELAY_MS * 2);
		assert.deepStrictEqual(log, ['b:true']);
	});

	test('the previous window steps down before the next one takes the role', async () => {
		openWindow('a', true);
		await waitUntil(() => log.length === 1);
		const { window } = openWindow('b', false);
		window.setFocused(true);
		await waitUntil(() => log.length === 3);
		assert.deepStrictEqual(log, ['a:true', 'a:false', 'b:true']);
	});

	test('takes the role back when focused again', async () => {
		const a = openWindow('a', true);
		await waitUntil(() => log.length === 1);
		const b = openWindow('b', false);
		b.window.setFocused(true);
		await waitUntil(() => log.length === 3);
		b.window.setFocused(false);
		a.window.setFocused(true);
		await waitUntil(() => log.length === 5);
		assert.deepStrictEqual(log, ['a:true', 'a:false', 'b:true', 'b:false', 'a:true']);
	});

	test('keeps the role when focus moves to another app', async () => {
		const { window } = openWindow('a', true);
		await waitUntil(() => log.length === 1);
		window.setFocused(false);
		await delay(POLL_MS * 3);
		assert.deepStrictEqual(log, ['a:true']);
	});

	test('does not report again when focused while already holding the role', async () => {
		const { window } = openWindow('a', true);
		await waitUntil(() => log.length === 1);
		window.setFocused(false);
		window.setFocused(true);
		await delay(HANDOVER_DELAY_MS * 2);
		assert.deepStrictEqual(log, ['a:true']);
	});

	test('reports nothing after dispose', async () => {
		const { leader } = openWindow('a', true);
		leader.dispose();
		await delay(HANDOVER_DELAY_MS * 2);
		assert.deepStrictEqual(log, []);
	});

	test('does not step down after dispose', async () => {
		const { leader } = openWindow('a', true);
		await waitUntil(() => log.length === 1);
		leader.dispose();
		const { window } = openWindow('b', false);
		window.setFocused(true);
		await waitUntil(() => log.length === 2);
		assert.deepStrictEqual(log, ['a:true', 'b:true']);
	});
});
