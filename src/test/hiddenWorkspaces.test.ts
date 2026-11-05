import * as assert from 'assert';
import { isHiddenWorkspace, WorkspaceIdentity } from '../presence/hiddenWorkspaces';

const APP: WorkspaceIdentity = { names: ['app'], paths: ['c:\\work\\app'] };

suite('hiddenWorkspaces', () => {
	test('matches the workspace name, ignoring case and surrounding spaces', () => {
		assert.ok(isHiddenWorkspace(APP, ['app']));
		assert.ok(isHiddenWorkspace(APP, ['  APP ']));
		assert.ok(!isHiddenWorkspace(APP, ['other']));
	});

	test('ignores empty entries and an empty list', () => {
		assert.ok(!isHiddenWorkspace(APP, []));
		assert.ok(!isHiddenWorkspace(APP, ['', '   ']));
	});

	test('matches a folder path written with either separator, a trailing separator, or other case', () => {
		assert.ok(isHiddenWorkspace(APP, ['C:\\work\\app']));
		assert.ok(isHiddenWorkspace(APP, ['c:/work/app']));
		assert.ok(isHiddenWorkspace(APP, ['C:\\Work\\App\\']));
	});

	test('matches folders inside a listed path, but not a sibling with the same prefix', () => {
		assert.ok(isHiddenWorkspace(APP, ['C:\\work']));
		assert.ok(isHiddenWorkspace(APP, ['C:\\']));
		assert.ok(!isHiddenWorkspace({ names: ['app'], paths: ['c:\\workshop\\app'] }, ['C:\\work']));
		assert.ok(!isHiddenWorkspace(APP, ['C:\\work\\app\\src']));
	});

	test('matches a remote folder by its remote path', () => {
		const remote: WorkspaceIdentity = { names: ['app', 'app [SSH: host]'], paths: ['\\home\\me\\app'] };
		assert.ok(isHiddenWorkspace(remote, ['/home/me/app']));
		assert.ok(isHiddenWorkspace(remote, ['/home/me']));
	});

	test('matches a remote folder by its name or its label', () => {
		const remote: WorkspaceIdentity = { names: ['app', 'app [SSH: host]'], paths: ['\\home\\me\\app'] };
		assert.ok(isHiddenWorkspace(remote, ['app']));
		assert.ok(isHiddenWorkspace(remote, ['app [ssh: host]']));
	});

	test('hides a multi-root workspace when any of its folders matches', () => {
		const multi: WorkspaceIdentity = {
			names: ['mixed', 'mixed (Workspace)'],
			paths: ['c:\\hobby\\site', 'c:\\work\\api', 'c:\\work\\mixed.code-workspace'],
		};
		assert.ok(isHiddenWorkspace(multi, ['C:\\work\\api']));
		assert.ok(isHiddenWorkspace(multi, ['C:\\work\\mixed.code-workspace']));
		assert.ok(isHiddenWorkspace(multi, ['mixed']));
		assert.ok(isHiddenWorkspace(multi, ['mixed (workspace)']));
		assert.ok(!isHiddenWorkspace(multi, ['C:\\other']));
	});

	test('never hides a window without a folder or workspace', () => {
		const empty: WorkspaceIdentity = { names: [], paths: [] };
		assert.ok(!isHiddenWorkspace(empty, ['app', 'C:\\', '/']));
	});

	test('does not match a name entry against part of a path', () => {
		const named: WorkspaceIdentity = { names: ['project'], paths: ['c:\\work\\app'] };
		assert.ok(!isHiddenWorkspace(named, ['app']));
		assert.ok(!isHiddenWorkspace(named, ['work']));
	});
});
