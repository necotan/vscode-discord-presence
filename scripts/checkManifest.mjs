// package.json とコード、アイコン、ドキュメントの食い違いを検査する
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...segments) => readFileSync(join(root, ...segments), "utf8");
const difference = (from, other) => [...from].filter((item) => !other.has(item));

const manifest = JSON.parse(read("package.json"));
const SECTION = "discordPresence.";
// アイコンがない言語と小さいロゴに使う
const LOGO_ICON = "vscode";
const errors = [];

if (Object.keys(manifest.dependencies ?? {}).length > 0) {
  errors.push("package.json: dependencies は空のままにしてください (Discord IPC は Node.js の組み込みモジュールだけで実装する)");
}

// Remote-SSH や WSL でも、Discord が動いているローカル側で実行させる
if (JSON.stringify(manifest.extensionKind) !== '["ui"]') {
  errors.push('package.json: extensionKind は ["ui"] のままにしてください');
}

const usedIcons = new Set([...read("src", "languages.ts").matchAll(/icon: '([^']+)'/g)].map((match) => match[1]));
usedIcons.add(LOGO_ICON);
const iconFiles = new Set(
  readdirSync(join(root, "assets", "icons"))
    .filter((name) => name.endsWith(".png"))
    .map((name) => name.slice(0, -".png".length)),
);
for (const icon of difference(usedIcons, iconFiles)) {
  errors.push(`assets/icons/${icon}.png がありません。npm run generate:icons を実行してください`);
}
for (const icon of difference(iconFiles, usedIcons)) {
  errors.push(`assets/icons/${icon}.png は src/languages.ts で使われていません`);
}

const settings = new Set(
  Object.keys(manifest.contributes.configuration.properties).map((key) => key.slice(SECTION.length)),
);
const readSettings = new Set(
  [...read("src", "config.ts").matchAll(/\.(?:get(?:<[^>]+>)?|update)\('([^']+)'/g)].map((match) => match[1]),
);
for (const key of difference(settings, readSettings)) {
  errors.push(`${SECTION}${key}: package.json にありますが、src/config.ts で読まれていません`);
}
for (const key of difference(readSettings, settings)) {
  errors.push(`${SECTION}${key}: src/config.ts で読んでいますが、package.json の contributes にありません`);
}

const sources = readdirSync(join(root, "src"), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !/[\\/]test$/.test(entry.parentPath))
  .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
  .join("\n");
const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
for (const command of commands) {
  if (!sources.includes(`'${command}'`)) {
    errors.push(`${command}: package.json にありますが、src/ に登録がありません`);
  }
}
for (const [, command] of sources.matchAll(/registerCommand\('([^']+)'/g)) {
  if (!commands.has(command)) {
    errors.push(`${command}: src/ で登録していますが、package.json の contributes にありません`);
  }
}

const hiddenCommands = new Set(
  (manifest.contributes.menus?.commandPalette ?? []).filter((entry) => entry.when === "false").map((entry) => entry.command),
);
const paletteTitles = manifest.contributes.commands
  .filter((entry) => !hiddenCommands.has(entry.command))
  .map((entry) => `${entry.category}: ${entry.title}`);
for (const file of ["README.md", "README.ja.md", "docs/requirements.md"]) {
  const text = read(file);
  for (const key of settings) {
    if (!text.includes(`${SECTION}${key}`)) {
      errors.push(`${file}: 設定 ${SECTION}${key} の説明がありません`);
    }
  }
  for (const title of paletteTitles) {
    if (!text.includes(title)) {
      errors.push(`${file}: コマンド "${title}" の説明がありません`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
