export const Opcode = {
	Handshake: 0,
	Frame: 1,
	Close: 2,
	Ping: 3,
	Pong: 4,
} as const;

export type Opcode = (typeof Opcode)[keyof typeof Opcode];

const HEADER_SIZE = 8;

export interface RawFrame {
	opcode: number;
	json: string;
}

export function encodeFrame(opcode: Opcode, payload: object): Buffer {
	const json = JSON.stringify(payload);
	// length は文字数ではなくバイト数。日本語のファイル名などで両者がずれる
	const length = Buffer.byteLength(json, 'utf8');
	const frame = Buffer.alloc(HEADER_SIZE + length);
	frame.writeUInt32LE(opcode, 0);
	frame.writeUInt32LE(length, 4);
	frame.write(json, HEADER_SIZE, 'utf8');
	return frame;
}

// 受信データは任意の位置で分割・結合されて届くため、完全なフレームだけを取り出して残りは次回に持ち越す。
// JSON の解析はここでは行わず、失敗時のログ出力を呼び出し側に任せる
export class FrameDecoder {
	private buffer: Buffer = Buffer.alloc(0);

	push(chunk: Buffer): RawFrame[] {
		this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
		const frames: RawFrame[] = [];
		while (this.buffer.length >= HEADER_SIZE) {
			const end = HEADER_SIZE + this.buffer.readUInt32LE(4);
			if (this.buffer.length < end) {
				break;
			}
			frames.push({
				opcode: this.buffer.readUInt32LE(0),
				json: this.buffer.toString('utf8', HEADER_SIZE, end),
			});
			this.buffer = this.buffer.subarray(end);
		}
		return frames;
	}
}
