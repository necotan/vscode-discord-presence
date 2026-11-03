import * as assert from 'assert';
import { buildActivity, ICON_BASE_URL, PresenceSettings, PresenceState, truncate } from '../presence/activityBuilder';

const ALL_ON: PresenceSettings = {
	showFileName: true,
	showLanguage: true,
	showWorkspace: true,
};

const EDITING: PresenceState = {
	idle: false,
	editor: { fileName: 'extension.ts', language: { name: 'TypeScript', icon: 'typescript' } },
	workspaceName: 'vscode-discord-presence',
	startedAt: 1_700_000_000_000,
};

const VSCODE_ASSETS = {
	large_image: `${ICON_BASE_URL}/vscode.png`,
	large_text: 'Visual Studio Code',
};

suite('activityBuilder', () => {
	test('builds the normal display with every setting on', () => {
		assert.deepStrictEqual(buildActivity(EDITING, ALL_ON), {
			details: 'Editing extension.ts',
			state: 'In vscode-discord-presence',
			timestamps: { start: 1_700_000_000_000 },
			assets: {
				large_image: `${ICON_BASE_URL}/typescript.png`,
				large_text: 'TypeScript',
				small_image: `${ICON_BASE_URL}/vscode.png`,
				small_text: 'Visual Studio Code',
			},
		});
	});

	test('uses a generic text when showFileName is off', () => {
		const activity = buildActivity(EDITING, { ...ALL_ON, showFileName: false });
		assert.strictEqual(activity.details, 'Editing a file');
	});

	test('shows only the VS Code logo when showLanguage is off', () => {
		const activity = buildActivity(EDITING, { ...ALL_ON, showLanguage: false });
		assert.deepStrictEqual(activity.assets, VSCODE_ASSETS);
	});

	test('falls back to the VS Code logo for a language without an icon', () => {
		const state: PresenceState = { ...EDITING, editor: { fileName: 'a.foo', language: { name: 'foo' } } };
		const activity = buildActivity(state, ALL_ON);
		assert.strictEqual(activity.assets?.large_image, `${ICON_BASE_URL}/vscode.png`);
		assert.strictEqual(activity.assets?.large_text, 'foo');
	});

	test('omits state when showWorkspace is off or no workspace is open', () => {
		assert.ok(!('state' in buildActivity(EDITING, { ...ALL_ON, showWorkspace: false })));
		assert.ok(!('state' in buildActivity({ ...EDITING, workspaceName: undefined }, ALL_ON)));
	});

	test('always sends the start time, even with every setting off', () => {
		const activity = buildActivity(EDITING, { showFileName: false, showLanguage: false, showWorkspace: false });
		assert.deepStrictEqual(activity.timestamps, { start: 1_700_000_000_000 });
	});

	test('builds the idle display when idle or without an editor, keeping the start time', () => {
		const expected = {
			details: 'Idling',
			timestamps: { start: 1_700_000_000_000 },
			assets: VSCODE_ASSETS,
		};
		assert.deepStrictEqual(buildActivity({ ...EDITING, idle: true }, ALL_ON), expected);
		assert.deepStrictEqual(buildActivity({ ...EDITING, editor: undefined }, ALL_ON), expected);
	});

	test('truncates long file and workspace names to 128 characters', () => {
		const state: PresenceState = {
			...EDITING,
			editor: { ...EDITING.editor!, fileName: 'a'.repeat(200) },
			workspaceName: 'w'.repeat(200),
		};
		const activity = buildActivity(state, ALL_ON);
		assert.strictEqual(Array.from(activity.details).length, 128);
		assert.ok(activity.details.endsWith('…'));
		assert.strictEqual(Array.from(activity.state ?? '').length, 128);
	});

	test('truncate keeps text up to 128 characters as is', () => {
		const text = 'a'.repeat(128);
		assert.strictEqual(truncate(text), text);
	});

	test('truncate counts surrogate pairs as one character and never splits them', () => {
		const result = truncate('😀'.repeat(130));
		assert.strictEqual(Array.from(result).length, 128);
		assert.strictEqual(result, `${'😀'.repeat(127)}…`);
	});
});
