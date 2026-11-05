import { randomUUID } from 'crypto';
import * as net from 'net';
import type { Logger } from '../ipc/discordIpc';
import { encodeFrame, FrameDecoder, Opcode, RawFrame } from '../ipc/frame';

export interface ReceivedFrame {
	opcode: number;
	payload: Record<string, unknown>;
}

export const SILENT_LOGGER: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};

export function uniquePipePath(): string {
	return `\\\\?\\pipe\\vscode-discord-presence-test-${randomUUID()}`;
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntil(condition: () => boolean, timeoutMs = 1_500): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error('Timed out waiting for the condition');
		}
		await delay(5);
	}
}

export class FakeDiscord {
	readonly path = uniquePipePath();
	readonly received: ReceivedFrame[] = [];
	sendReady = true;
	answerActivity = true;
	connectionCount = 0;

	private readonly sockets = new Set<net.Socket>();
	private readonly server = net.createServer((socket) => this.accept(socket));

	get openConnections(): number {
		return this.sockets.size;
	}

	listen(): Promise<void> {
		return new Promise((resolve) => this.server.listen(this.path, resolve));
	}

	close(): Promise<void> {
		this.dropConnections();
		// 起動していないサーバーを閉じたときのエラーは、テストの後片付けでは問題にならない
		return new Promise((resolve) => this.server.close(() => resolve()));
	}

	dropConnections(): void {
		for (const socket of this.sockets) {
			socket.destroy();
		}
	}

	send(opcode: Opcode, payload: object): void {
		this.sendRaw(encodeFrame(opcode, payload));
	}

	sendRaw(data: Buffer): void {
		for (const socket of this.sockets) {
			socket.write(data);
		}
	}

	frames(opcode: Opcode): ReceivedFrame[] {
		return this.received.filter((frame) => frame.opcode === opcode);
	}

	activityCommands(): ReceivedFrame[] {
		return this.frames(Opcode.Frame).filter((frame) => frame.payload.cmd === 'SET_ACTIVITY');
	}

	private accept(socket: net.Socket): void {
		this.connectionCount++;
		this.sockets.add(socket);
		const decoder = new FrameDecoder();
		// クライアントが先に閉じたときの書き込みエラーを、未処理例外にしない
		socket.on('error', () => undefined);
		socket.on('close', () => this.sockets.delete(socket));
		socket.on('data', (chunk: Buffer) => {
			for (const frame of decoder.push(chunk)) {
				this.handleFrame(socket, frame);
			}
		});
	}

	private handleFrame(socket: net.Socket, frame: RawFrame): void {
		const payload = JSON.parse(frame.json) as Record<string, unknown>;
		this.received.push({ opcode: frame.opcode, payload });
		if (frame.opcode === Opcode.Handshake && this.sendReady) {
			socket.write(encodeFrame(Opcode.Frame, { cmd: 'DISPATCH', evt: 'READY', data: { v: 1 } }));
		}
		if (payload.cmd === 'SET_ACTIVITY' && this.answerActivity) {
			socket.write(encodeFrame(Opcode.Frame, { cmd: 'SET_ACTIVITY', nonce: payload.nonce, data: {} }));
		}
	}
}
