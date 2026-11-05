import * as assert from 'assert';
import { resolveWorkspaceName, WorkspaceLocation } from '../presence/workspaceName';

function local(path: string): WorkspaceLocation {
	return { scheme: 'file', path };
}

function remote(path: string): WorkspaceLocation {
	return { scheme: 'vscode-remote', path };
}

suite('workspaceName', () => {
	test('uses the folder name for a single folder', () => {
		assert.strictEqual(resolveWorkspaceName(undefined, [local('/c:/work/proj')]), 'proj');
		assert.strictEqual(resolveWorkspaceName(undefined, [local('/c:/work/proj/')]), 'proj');
		assert.strictEqual(resolveWorkspaceName(undefined, [remote('/home/me/proj')]), 'proj');
	});

	test('keeps .code-workspace in a folder name', () => {
		assert.strictEqual(resolveWorkspaceName(undefined, [local('/c:/work/a.code-workspace')]), 'a.code-workspace');
	});

	test('uses the file name without its extension for a saved workspace', () => {
		const folders = [local('/c:/work/api'), local('/c:/work/site')];
		assert.strictEqual(resolveWorkspaceName(local('/c:/work/proj.code-workspace'), folders), 'proj');
		assert.strictEqual(resolveWorkspaceName(remote('/home/me/proj.code-workspace'), [remote('/home/me/api')]), 'proj');
		assert.strictEqual(resolveWorkspaceName(local('/c:/work/proj.code-workspace'), []), 'proj');
	});

	test('has no name for an unsaved multi-root workspace, even with folders', () => {
		const untitled: WorkspaceLocation = { scheme: 'untitled', path: 'workspace.code-workspace' };
		assert.strictEqual(resolveWorkspaceName(untitled, [local('/c:/work/api')]), undefined);
	});

	test('has no name for a window without a folder or workspace', () => {
		assert.strictEqual(resolveWorkspaceName(undefined, []), undefined);
	});

	test('handles root folders', () => {
		assert.strictEqual(resolveWorkspaceName(undefined, [remote('/')]), undefined);
		assert.strictEqual(resolveWorkspaceName(undefined, [local('/c:/')]), 'c:');
	});
});
