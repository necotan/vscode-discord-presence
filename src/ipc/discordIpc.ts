import { randomUUID } from 'crypto';
import * as net from 'net';
import { encodeFrame, FrameDecoder, Opcode, RawFrame } from './frame';
import { getIpcPaths } from './getIpcPath';

const RETRY_INTERVAL_MS = 15_000;
// deactivate に使える時間は短いため、クリアの応答を待つのはこの時間まで
const CLEAR_TIMEOUT_MS = 1_000;

export interface Activity {
	details: string;
	state?: string;
	timestamps?: { start: number };
	assets?: {
		large_image?: string;
		large_text?: string;
		small_image?: string;
		small_text?: string;
	};
}

// vscode.LogOutputChannel をそのまま渡せる形にして、このモジュールを vscode に依存させない
export interface Logger {
	debug(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
}

export interface DiscordIpcOptions {
	clientId: string;
	logger: Logger;
	onReady: () => void;
}

interface IpcMessage {
	cmd?: string;
	evt?: string | null;
	nonce?: string | null;
	data?: { code?: number; message?: string } | null;
}

interface ClosePayload {
	code?: number;
	message?: string;
}

export class DiscordIpcClient {
	private running = false;
	private ready = false;
	private socket: net.Socket | undefined;
	private decoder: FrameDecoder | undefined;
	private retryTimer: NodeJS.Timeout | undefined;
	private attempt = 0;
	private pendingClear: { nonce: string; resolve: () => void } | undefined;

	constructor(private readonly options: DiscordIpcOptions) {}

	start(): void {
		if (this.running) {
			return;
		}
		this.running = true;
		void this.connect();
	}

	async stop(): Promise<void> {
		this.running = false;
		this.clearRetryTimer();
		await this.clearActivityAndWait();
		this.closeSocket();
	}

	reconnect(): void {
		this.clearRetryTimer();
		this.closeSocket();
		if (this.running) {
			void this.connect();
		}
	}

	// READY 前は送らずに false を返す。呼び出し側は onReady で送り直す
	setActivity(activity: Activity | undefined): boolean {
		return this.sendSetActivity(activity) !== undefined;
	}

	private async connect(): Promise<void> {
		const attempt = ++this.attempt;
		const paths = getIpcPaths();
		if (paths.length === 0) {
			this.options.logger.error(`Unsupported platform: ${process.platform}`);
			return;
		}
		for (const path of paths) {
			const socket = await this.tryConnect(path);
			// 接続待ちの間に stop や reconnect が呼ばれた場合は、この試行の結果を捨てる
			if (attempt !== this.attempt || !this.running) {
				socket?.destroy();
				return;
			}
			if (socket) {
				this.attach(socket, path);
				return;
			}
		}
		this.options.logger.info(`Discord not found. Retrying in ${RETRY_INTERVAL_MS / 1000} s`);
		this.scheduleRetry();
	}

	private tryConnect(path: string): Promise<net.Socket | undefined> {
		return new Promise((resolve) => {
			const socket = net.createConnection(path);
			// 接続後も attach で差し替えるまで残し、その間に error が来ても未処理例外にしない
			socket.once('error', (error: NodeJS.ErrnoException) => {
				this.options.logger.debug(`${path}: ${error.code ?? error.message}`);
				socket.destroy();
				resolve(undefined);
			});
			socket.once('connect', () => resolve(socket));
		});
	}

	private attach(socket: net.Socket, path: string): void {
		this.socket = socket;
		this.decoder = new FrameDecoder();
		socket.removeAllListeners('error');
		// error の後には必ず close が来るため、切断の処理は close 側だけで行う
		socket.on('error', (error) => this.options.logger.warn(`IPC error: ${error.message}`));
		socket.on('close', () => this.handleDisconnect(socket, 'pipe closed'));
		socket.on('data', (chunk: Buffer) => this.handleData(socket, chunk));
		this.options.logger.info(`Connected to ${path}`);
		this.write(Opcode.Handshake, { v: 1, client_id: this.options.clientId });
	}

	private handleData(socket: net.Socket, chunk: Buffer): void {
		if (socket !== this.socket || !this.decoder) {
			return;
		}
		try {
			for (const frame of this.decoder.push(chunk)) {
				this.handleFrame(socket, frame);
			}
		} catch (error) {
			this.options.logger.error(`Failed to handle IPC data: ${String(error)}`);
		}
	}

	private handleFrame(socket: net.Socket, frame: RawFrame): void {
		const payload = parseJsonObject(frame.json);
		if (!payload) {
			this.options.logger.warn(`Invalid JSON in IPC frame (opcode ${frame.opcode})`);
			return;
		}
		switch (frame.opcode) {
			case Opcode.Frame:
				this.handleMessage(payload as IpcMessage);
				break;
			case Opcode.Close: {
				const { code, message } = payload as ClosePayload;
				this.handleDisconnect(socket, `closed by Discord: ${code} ${message}`);
				break;
			}
			case Opcode.Ping:
				this.write(Opcode.Pong, payload);
				break;
			default:
				this.options.logger.debug(`Ignored IPC opcode ${frame.opcode}`);
		}
	}

	private handleMessage(message: IpcMessage): void {
		if (message.cmd === 'DISPATCH' && message.evt === 'READY') {
			this.ready = true;
			this.options.logger.info('Discord is ready');
			this.options.onReady();
			return;
		}
		if (message.evt === 'ERROR') {
			this.options.logger.warn(`${message.cmd} failed: ${message.data?.code} ${message.data?.message}`);
		}
		if (this.pendingClear && message.nonce === this.pendingClear.nonce) {
			this.pendingClear.resolve();
		}
	}

	private handleDisconnect(socket: net.Socket, reason: string): void {
		if (socket !== this.socket) {
			return;
		}
		this.closeSocket();
		this.pendingClear?.resolve();
		if (!this.running) {
			return;
		}
		this.options.logger.info(`Disconnected (${reason}). Retrying in ${RETRY_INTERVAL_MS / 1000} s`);
		this.scheduleRetry();
	}

	private sendSetActivity(activity: Activity | undefined): string | undefined {
		if (!this.ready) {
			this.options.logger.debug('Not ready. Activity was not sent');
			return undefined;
		}
		const nonce = randomUUID();
		// activity が undefined なら JSON から省かれ、Discord 側ではクリアとして扱われる
		this.write(Opcode.Frame, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce });
		return nonce;
	}

	private async clearActivityAndWait(): Promise<void> {
		const nonce = this.sendSetActivity(undefined);
		if (!nonce) {
			return;
		}
		await new Promise<void>((resolve) => {
			const done = (): void => {
				clearTimeout(timer);
				this.pendingClear = undefined;
				resolve();
			};
			const timer = setTimeout(done, CLEAR_TIMEOUT_MS);
			this.pendingClear = { nonce, resolve: done };
		});
	}

	private write(opcode: Opcode, payload: object): void {
		this.socket?.write(encodeFrame(opcode, payload));
	}

	private closeSocket(): void {
		this.socket?.destroy();
		this.socket = undefined;
		this.decoder = undefined;
		this.ready = false;
	}

	private scheduleRetry(): void {
		if (this.retryTimer) {
			return;
		}
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined;
			void this.connect();
		}, RETRY_INTERVAL_MS);
	}

	private clearRetryTimer(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = undefined;
		}
	}
}

function parseJsonObject(json: string): object | undefined {
	try {
		const value: unknown = JSON.parse(json);
		return typeof value === 'object' && value !== null ? value : undefined;
	} catch {
		return undefined;
	}
}
