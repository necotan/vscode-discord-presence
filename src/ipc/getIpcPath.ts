const PIPE_COUNT = 10;

export const UNSUPPORTED_PLATFORM_MESSAGE = `Unsupported platform: ${process.platform}`;

// Stable / PTB / Canary を同時に起動すると別々の番号を使うため、0〜9 をすべて候補にする
export function getIpcPaths(): string[] {
	if (process.platform !== 'win32') {
		return [];
	}
	return Array.from({ length: PIPE_COUNT }, (_, n) => `\\\\?\\pipe\\discord-ipc-${n}`);
}
