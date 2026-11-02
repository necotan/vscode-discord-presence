import * as assert from 'assert';
import { encodeFrame, FrameDecoder, Opcode } from '../ipc/frame';

suite('frame', () => {
	test('encodes opcode and byte length in little endian', () => {
		const frame = encodeFrame(Opcode.Frame, { a: 1 });
		const json = '{"a":1}';
		assert.strictEqual(frame.readUInt32LE(0), Opcode.Frame);
		assert.strictEqual(frame.readUInt32LE(4), json.length);
		assert.strictEqual(frame.toString('utf8', 8), json);
	});

	test('uses byte length, not string length, for multi-byte text', () => {
		const frame = encodeFrame(Opcode.Frame, { name: '設定.ts' });
		const json = '{"name":"設定.ts"}';
		assert.notStrictEqual(Buffer.byteLength(json), json.length);
		assert.strictEqual(frame.readUInt32LE(4), Buffer.byteLength(json));
		assert.strictEqual(frame.length, 8 + Buffer.byteLength(json));
	});

	test('decodes a single frame', () => {
		const decoder = new FrameDecoder();
		const frames = decoder.push(encodeFrame(Opcode.Ping, { x: 'y' }));
		assert.deepStrictEqual(frames, [{ opcode: Opcode.Ping, json: '{"x":"y"}' }]);
	});

	test('decodes a frame split into single bytes, including inside a multi-byte character', () => {
		const decoder = new FrameDecoder();
		const encoded = encodeFrame(Opcode.Frame, { name: '設定.ts' });
		const frames = [];
		for (let i = 0; i < encoded.length; i++) {
			frames.push(...decoder.push(encoded.subarray(i, i + 1)));
		}
		assert.deepStrictEqual(frames, [{ opcode: Opcode.Frame, json: '{"name":"設定.ts"}' }]);
	});

	test('decodes several frames in one chunk', () => {
		const decoder = new FrameDecoder();
		const chunk = Buffer.concat([encodeFrame(Opcode.Frame, { n: 1 }), encodeFrame(Opcode.Close, { n: 2 })]);
		assert.deepStrictEqual(decoder.push(chunk), [
			{ opcode: Opcode.Frame, json: '{"n":1}' },
			{ opcode: Opcode.Close, json: '{"n":2}' },
		]);
	});

	test('keeps an incomplete frame for the next chunk', () => {
		const decoder = new FrameDecoder();
		const first = encodeFrame(Opcode.Frame, { n: 1 });
		const second = encodeFrame(Opcode.Frame, { n: 2 });
		const chunk = Buffer.concat([first, second.subarray(0, 5)]);
		assert.deepStrictEqual(decoder.push(chunk), [{ opcode: Opcode.Frame, json: '{"n":1}' }]);
		assert.deepStrictEqual(decoder.push(second.subarray(5)), [{ opcode: Opcode.Frame, json: '{"n":2}' }]);
	});
});
