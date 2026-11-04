import * as assert from 'assert';
import type { IpcState } from '../ipc/discordIpc';
import { describeStatus, resolveStatus, StatusInput } from '../presence/connectionStatus';

const LEADER: StatusInput = { enabled: true, hiddenMode: undefined, leader: true, ipc: 'connected' };
const IPC_STATES: IpcState[] = ['stopped', 'connecting', 'waiting', 'connected'];

suite('connectionStatus', () => {
	test('is disabled whenever enabled is off', () => {
		for (const ipc of IPC_STATES) {
			assert.strictEqual(resolveStatus({ enabled: false, hiddenMode: 'hide', leader: true, ipc }), 'disabled');
			assert.strictEqual(resolveStatus({ enabled: false, hiddenMode: undefined, leader: false, ipc }), 'disabled');
		}
	});

	test('shows hidden for the hide mode, even when another window is shown', () => {
		assert.strictEqual(resolveStatus({ ...LEADER, hiddenMode: 'hide', ipc: 'stopped' }), 'hidden');
		assert.strictEqual(resolveStatus({ ...LEADER, hiddenMode: 'hide', leader: false, ipc: 'stopped' }), 'hidden');
	});

	test('keeps the connection state for the mask mode', () => {
		assert.strictEqual(resolveStatus({ ...LEADER, hiddenMode: 'mask' }), 'connected');
		assert.strictEqual(resolveStatus({ ...LEADER, hiddenMode: 'mask', leader: false, ipc: 'stopped' }), 'otherWindow');
	});

	test('shows otherWindow when this window is not the leader', () => {
		assert.strictEqual(resolveStatus({ ...LEADER, leader: false, ipc: 'stopped' }), 'otherWindow');
	});

	test('follows the IPC state in the leader window, treating stopped as connecting', () => {
		assert.strictEqual(resolveStatus({ ...LEADER, ipc: 'stopped' }), 'connecting');
		assert.strictEqual(resolveStatus({ ...LEADER, ipc: 'connecting' }), 'connecting');
		assert.strictEqual(resolveStatus({ ...LEADER, ipc: 'waiting' }), 'waiting');
		assert.strictEqual(resolveStatus({ ...LEADER, ipc: 'connected' }), 'connected');
	});

	test('describes each status with its icon and message', () => {
		assert.deepStrictEqual(describeStatus('connected', false), {
			text: '$(broadcast) Discord',
			tooltip: 'Discord Presence\nShown on Discord.\nClick for actions.',
		});
		assert.strictEqual(describeStatus('disabled', false).text, '$(circle-slash) Discord');
		assert.strictEqual(describeStatus('hidden', false).text, '$(eye-closed) Discord');
		assert.strictEqual(describeStatus('otherWindow', false).text, '$(window) Discord');
		assert.strictEqual(describeStatus('connecting', false).text, '$(sync~spin) Discord');
		assert.strictEqual(describeStatus('waiting', false).text, '$(debug-disconnect) Discord');
	});

	test('mentions masking only while connected', () => {
		assert.ok(describeStatus('connected', true).tooltip.includes('masked in this workspace'));
		assert.ok(!describeStatus('waiting', true).tooltip.includes('masked'));
	});
});
