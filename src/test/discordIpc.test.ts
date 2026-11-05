import * as assert from 'assert';
import { Activity, DiscordIpcClient, IpcState } from '../ipc/discordIpc';
import { Opcode } from '../ipc/frame';
import { delay, FakeDiscord, SILENT_LOGGER, uniquePipePath, waitUntil } from './fakeDiscord';

const ACTIVITY: Activity = { details: 'Editing a.ts' };
const RETRY_MS = 20;

suite('discordIpc', () => {
	let discord: FakeDiscord;
	let client: DiscordIpcClient | undefined;
	let states: IpcState[];
	let readyCount: number;

	function createClient(options: { paths?: string[]; retryIntervalMs?: number } = {}): DiscordIpcClient {
		client = new DiscordIpcClient({
			clientId: 'client-a',
			logger: SILENT_LOGGER,
			onReady: () => readyCount++,
			onStateChange: (state) => states.push(state),
			getPaths: () => options.paths ?? [discord.path],
			retryIntervalMs: options.retryIntervalMs ?? RETRY_MS,
		});
		return client;
	}

	async function connectClient(options: { retryIntervalMs?: number } = {}): Promise<DiscordIpcClient> {
		const ipc = createClient(options);
		ipc.start();
		await waitUntil(() => readyCount === 1);
		return ipc;
	}

	setup(async () => {
		discord = new FakeDiscord();
		await discord.listen();
		client = undefined;
		states = [];
		readyCount = 0;
	});

	teardown(async () => {
		discord.answerActivity = true;
		await client?.stop();
		await discord.close();
	});

	suite('connecting', () => {
		test('sends the handshake and becomes connected after READY', async () => {
			await connectClient();
			assert.deepStrictEqual(discord.frames(Opcode.Handshake).map((frame) => frame.payload), [{ v: 1, client_id: 'client-a' }]);
			assert.deepStrictEqual(states, ['connecting', 'connected']);
		});

		test('stays connecting until READY', async () => {
			discord.sendReady = false;
			createClient().start();
			await waitUntil(() => discord.frames(Opcode.Handshake).length === 1);
			await delay(RETRY_MS * 2);
			assert.deepStrictEqual(states, ['connecting']);
			assert.strictEqual(readyCount, 0);
		});

		test('tries the next path when the first one has no server', async () => {
			createClient({ paths: [uniquePipePath(), discord.path] }).start();
			await waitUntil(() => readyCount === 1);
			assert.deepStrictEqual(states, ['connecting', 'connected']);
		});
	});

	suite('sending', () => {
		test('does not send an activity before READY', async () => {
			discord.sendReady = false;
			const ipc = createClient();
			ipc.start();
			await waitUntil(() => discord.frames(Opcode.Handshake).length === 1);
			assert.strictEqual(ipc.setActivity(ACTIVITY), false);
			await delay(RETRY_MS);
			assert.strictEqual(discord.activityCommands().length, 0);
		});

		test('sends the activity with the process ID and a nonce after READY', async () => {
			const ipc = await connectClient();
			assert.strictEqual(ipc.setActivity(ACTIVITY), true);
			await waitUntil(() => discord.activityCommands().length === 1);
			const { args, nonce } = discord.activityCommands()[0].payload;
			assert.deepStrictEqual(args, { pid: process.pid, activity: ACTIVITY });
			assert.strictEqual(typeof nonce, 'string');
		});

		test('answers PING with the same payload', async () => {
			await connectClient();
			discord.send(Opcode.Ping, { n: 1 });
			await waitUntil(() => discord.frames(Opcode.Pong).length === 1);
			assert.deepStrictEqual(discord.frames(Opcode.Pong)[0].payload, { n: 1 });
		});

		test('keeps working after a frame with invalid JSON', async () => {
			await connectClient();
			const json = Buffer.from('{broken');
			const header = Buffer.alloc(8);
			header.writeUInt32LE(Opcode.Frame, 0);
			header.writeUInt32LE(json.length, 4);
			discord.sendRaw(Buffer.concat([header, json]));
			discord.send(Opcode.Ping, { n: 2 });
			await waitUntil(() => discord.frames(Opcode.Pong).length === 1);
			assert.deepStrictEqual(states, ['connecting', 'connected']);
		});
	});

	suite('retrying', () => {
		test('waits while Discord is missing and connects without going back to connecting', async () => {
			await discord.close();
			createClient().start();
			await waitUntil(() => states.includes('waiting'));
			await delay(RETRY_MS * 3);
			await discord.listen();
			await waitUntil(() => readyCount === 1);
			assert.deepStrictEqual(states, ['connecting', 'waiting', 'connected']);
		});

		test('reconnects after the connection is lost, and reports READY again', async () => {
			await connectClient();
			discord.dropConnections();
			await waitUntil(() => readyCount === 2);
			assert.deepStrictEqual(states, ['connecting', 'connected', 'waiting', 'connected']);
		});

		test('reconnects after CLOSE', async () => {
			await connectClient();
			discord.send(Opcode.Close, { code: 4000, message: 'Invalid Client ID' });
			await waitUntil(() => readyCount === 2);
			assert.deepStrictEqual(states, ['connecting', 'connected', 'waiting', 'connected']);
			assert.strictEqual(discord.frames(Opcode.Handshake).length, 2);
		});

		test('does not send on the old connection while waiting', async () => {
			const ipc = await connectClient({ retryIntervalMs: 60_000 });
			discord.dropConnections();
			await waitUntil(() => states.includes('waiting'));
			assert.strictEqual(ipc.setActivity(ACTIVITY), false);
		});
	});

	suite('stop', () => {
		test('clears the activity, closes the connection, and does not retry', async () => {
			const ipc = await connectClient();
			await ipc.stop();
			const commands = discord.activityCommands();
			assert.strictEqual(commands.length, 1);
			assert.deepStrictEqual(commands[0].payload.args, { pid: process.pid });
			assert.strictEqual(states.at(-1), 'stopped');
			await waitUntil(() => discord.openConnections === 0);
			await delay(RETRY_MS * 3);
			assert.strictEqual(discord.connectionCount, 1);
		});

		test('gives up waiting for the clear after about 1 s', async () => {
			const ipc = await connectClient();
			discord.answerActivity = false;
			const startedAt = Date.now();
			await ipc.stop();
			const elapsed = Date.now() - startedAt;
			assert.ok(elapsed >= 900 && elapsed < 1_500, `took ${elapsed} ms`);
			await waitUntil(() => discord.openConnections === 0);
		});

		test('does not send the clear before READY', async () => {
			discord.sendReady = false;
			const ipc = createClient();
			ipc.start();
			await waitUntil(() => discord.frames(Opcode.Handshake).length === 1);
			await ipc.stop();
			assert.strictEqual(discord.activityCommands().length, 0);
			await waitUntil(() => discord.openConnections === 0);
		});

		test('cancels a pending retry', async () => {
			await discord.close();
			const ipc = createClient();
			ipc.start();
			await waitUntil(() => states.includes('waiting'));
			await ipc.stop();
			await discord.listen();
			await delay(RETRY_MS * 3);
			assert.strictEqual(discord.connectionCount, 0);
		});

		test('leaves no connection when stopped during a connection attempt', async () => {
			const ipc = createClient();
			ipc.start();
			await ipc.stop();
			await delay(RETRY_MS * 2);
			assert.strictEqual(discord.openConnections, 0);
			assert.deepStrictEqual(states, ['connecting', 'stopped']);
		});

		test('keeps the new connection when started while waiting for the clear', async () => {
			const ipc = await connectClient();
			discord.answerActivity = false;
			const stopping = ipc.stop();
			ipc.start();
			await stopping;
			await waitUntil(() => readyCount === 2);
			await delay(RETRY_MS);
			assert.strictEqual(discord.openConnections, 1);
			assert.strictEqual(ipc.setActivity(ACTIVITY), true);
			assert.strictEqual(states.at(-1), 'connected');
		});

		test('connects again when started after stop', async () => {
			const ipc = await connectClient();
			await ipc.stop();
			ipc.start();
			await waitUntil(() => readyCount === 2);
			assert.deepStrictEqual(states, ['connecting', 'connected', 'stopped', 'connecting', 'connected']);
		});
	});

	suite('reconnect and setClientId', () => {
		test('reconnects at once, without waiting for the retry interval', async () => {
			const ipc = await connectClient({ retryIntervalMs: 60_000 });
			ipc.reconnect();
			await waitUntil(() => readyCount === 2);
			assert.strictEqual(discord.connectionCount, 2);
		});

		test('reconnect does nothing while stopped', async () => {
			createClient().reconnect();
			await delay(RETRY_MS * 2);
			assert.strictEqual(discord.connectionCount, 0);
		});

		test('setClientId reconnects with the new ID only when it changes', async () => {
			const ipc = await connectClient();
			ipc.setClientId('client-a');
			ipc.setClientId('client-b');
			await waitUntil(() => readyCount === 2);
			const handshakes = discord.frames(Opcode.Handshake).map((frame) => frame.payload.client_id);
			assert.deepStrictEqual(handshakes, ['client-a', 'client-b']);
		});
	});
});
