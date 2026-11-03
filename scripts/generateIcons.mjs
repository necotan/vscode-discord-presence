// Discord は SVG の画像 URL を表示できないため、devicon の SVG を PNG に変換して assets/icons/ に置く。
// 依存パッケージを増やさないよう、インストール済みの Chrome（または Edge）のヘッドレス撮影で描画する
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEVICON_VERSION = 'v2.17.0';
const BASE_URL = `https://cdn.jsdelivr.net/gh/devicons/devicon@${DEVICON_VERSION}`;
const SIZE = 512;
// Discord が角を丸めて表示しても欠けないよう余白を取る
const ICON_SIZE = 448;
const OUT_DIR = resolve('assets/icons');
const RENDER_TIMEOUT_MS = 20_000;
const POLL_MS = 300;

const BROWSER_CANDIDATES = [
	process.env.CHROME_PATH,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function findBrowser() {
	const browser = BROWSER_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
	if (!browser) {
		throw new Error('Chrome or Edge was not found. Set CHROME_PATH.');
	}
	return browser;
}

// languages.ts の icon と VS Code のロゴを対象にする
function getIconNames() {
	const source = readFileSync('src/languages.ts', 'utf8');
	const names = new Set([...source.matchAll(/icon: '([\w-]+)'/g)].map((match) => match[1]));
	names.add('vscode');
	return [...names].sort();
}

async function fetchText(url) {
	const response = await fetch(url);
	return response.ok ? response.text() : undefined;
}

async function fetchSvg(name) {
	for (const variant of ['original', 'plain']) {
		const svg = await fetchText(`${BASE_URL}/icons/${name}/${name}-${variant}.svg`);
		if (svg) {
			return svg;
		}
	}
	throw new Error(`devicon ${DEVICON_VERSION} has no SVG for "${name}"`);
}

async function renderPng(browser, workDir, name, svg) {
	const html = join(workDir, `${name}.html`);
	const output = join(OUT_DIR, `${name}.png`);
	rmSync(output, { force: true });
	const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
	writeFileSync(html, `<!doctype html>
<html><head><style>
html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: transparent; }
body { display: flex; align-items: center; justify-content: center; }
img { width: ${ICON_SIZE}px; height: ${ICON_SIZE}px; object-fit: contain; }
</style></head><body><img src="${dataUrl}"></body></html>`);
	execFileSync(browser, [
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		'--default-background-color=00000000',
		`--window-size=${SIZE},${SIZE}`,
		`--screenshot=${output}`,
		// 普段使っているブラウザのプロファイルに触れないよう使い捨てのプロファイルで起動する。
		// 同じプロファイルを使い回すと、終了しきっていない前回のブラウザに処理が渡されて撮影されないため、アイコンごとに分ける
		`--user-data-dir=${join(workDir, `profile-${name}`)}`,
		pathToFileURL(html).href,
	], { stdio: 'ignore' });
	await waitForFile(output);
}

// Windows では起動したプロセスが撮影の完了を待たずに終了し、PNG は数秒後に書き出されるため、
// ファイルができてサイズが変わらなくなるまで待つ
async function waitForFile(path) {
	const deadline = Date.now() + RENDER_TIMEOUT_MS;
	let lastSize = -1;
	while (Date.now() < deadline) {
		const size = existsSync(path) ? statSync(path).size : 0;
		if (size > 0 && size === lastSize) {
			return;
		}
		lastSize = size;
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
	throw new Error(`Timed out rendering ${path}`);
}

async function main() {
	const browser = findBrowser();
	mkdirSync(OUT_DIR, { recursive: true });
	const workDir = mkdtempSync(join(tmpdir(), 'generate-icons-'));
	try {
		for (const name of getIconNames()) {
			await renderPng(browser, workDir, name, await fetchSvg(name));
			console.log(`${name}.png`);
		}
		// MIT ライセンスは複製物に著作権表示と許諾文を含めることを求めるため、変換した画像と一緒に置く
		const license = await fetchText(`${BASE_URL}/LICENSE`);
		if (!license) {
			throw new Error('Failed to fetch the devicon LICENSE');
		}
		writeFileSync(join(OUT_DIR, 'LICENSE-devicon.txt'), license);
	} finally {
		// ブラウザの補助プロセスが終了直後もプロファイルを掴んでいて EPERM になることがあるため、待って再試行する
		try {
			rmSync(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
		} catch (error) {
			console.warn(`Could not remove ${workDir}: ${error.message}`);
		}
	}
}

await main();
