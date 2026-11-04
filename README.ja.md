<h1 align="center">Discord Presence</h1>

<p align="center">
  <a href="README.md">English</a> | 日本語
</p>

<p align="center">
  編集中のファイル、言語、ワークスペースを Discord に表示する VS Code 拡張機能です。<br>
  ランタイムの依存パッケージはなく、Node.js の標準モジュールだけで Discord のローカル IPC と通信します。
</p>

## 機能

Discord のプロフィールに **Visual Studio Code をプレイ中** と表示され、次の内容が出ます。

- `Editing <ファイル名>`
- `In <ワークスペース名>`
- 言語のアイコン（マウスを乗せると言語名）と、右下に VS Code のロゴ
- VS Code のウィンドウを開いてからの経過時間

ファイルを開いていないとき、または VS Code からフォーカスが外れて5分たったとき（変更可）は `Idling` になります。

VS Code のウィンドウを複数開いている場合は、最後にフォーカスしたウィンドウの内容が表示されます。

ステータスバーの **Discord** で、ウィンドウごとの状態（Discord に表示中、Discord が見つからない、別のウィンドウを表示中、隠している、オフ）がわかります。マウスを乗せると説明が出て、クリックするとメニュー（オフ/オン、再接続、ログを開く、設定を開く）が出ます。要らない場合は、ステータスバーを右クリックして **Discord Presence** のチェックを外してください。

## 動作環境

- Windows
- Discord デスクトップアプリ（ブラウザ版の Discord には対応していません）
- VS Code 1.144 以降
- Discord の **ユーザー設定 > アクティビティのプライバシー** で、検出されたアクティビティの共有をオンにしてください。

Remote-SSH、WSL、Dev Containers でも使えます。拡張機能は、Discord が動いている手元の PC 側で動きます。

## インストール

Marketplace には公開していません。`.vsix` ファイルからインストールします。

1. `vscode-discord-presence-<バージョン>.vsix` を入手します（Releases ページから、または自分でビルド。[開発](#開発)を参照）。
2. VS Code でコマンドパレット（`Ctrl+Shift+P`）を開き、**Extensions: Install from VSIX...** を実行してファイルを選びます。

更新するときは、新しい `.vsix` を同じ手順でインストールします。アンインストールは拡張機能ビューから行います。

## 設定

| 設定 | 既定値 | 説明 |
|---|---|---|
| `discordPresence.enabled` | `true` | VS Code の作業内容を Discord に表示する |
| `discordPresence.clientId` | `""` | 自分で作った Discord アプリケーションの Application ID。「プレイ中」の名前を変えるときに使う。空なら組み込みのもの（「Visual Studio Code」）を使う |
| `discordPresence.showFileName` | `true` | ファイル名を表示する（オフのときは `Editing a file`） |
| `discordPresence.showLanguage` | `true` | 言語名とアイコンを表示する（オフのときは VS Code のロゴだけ） |
| `discordPresence.showVSCodeLogo` | `true` | 言語アイコンの右下に、小さな VS Code のロゴを表示する |
| `discordPresence.showWorkspace` | `true` | ワークスペース名を表示する |
| `discordPresence.hiddenWorkspaces` | `[]` | 表示を隠すワークスペースの名前かフォルダのパス（下を参照） |
| `discordPresence.hiddenWorkspaceMode` | `"hide"` | `hide` は何も表示しない。`mask` は `Editing a file` と VS Code のロゴだけを表示する |
| `discordPresence.idleTimeoutMinutes` | `5` | VS Code からフォーカスが外れてから `Idling` にするまでの分数。`0` ですぐ |

経過時間は消せません。送らなかった場合でも、Discord が自分で数えて表示するためです。

### 特定のワークスペースで隠す

ユーザー設定の `discordPresence.hiddenWorkspaces` に、ワークスペースの名前かフォルダのパスを書きます。ワークスペース側には何も置かなくて済みます。

```json
"discordPresence.hiddenWorkspaces": ["school-report", "C:/work"],
"discordPresence.hiddenWorkspaceMode": "hide"
```

- `/` か `\` を含む項目はフォルダのパスとして扱い、その中のフォルダも隠れます（`C:/work` で `C:/work/app` も隠れる）。それ以外の項目はワークスペース名（「In」の後ろの名前）です。大文字と小文字は区別しません。`settings.json` では `\` を `\\` と書くか、`/` を使ってください。
- マルチルートのワークスペースでは、どれか1つのフォルダが一致すると、そのウィンドウ全体が隠れます。
- Remote-SSH、WSL、Dev Containers では、リモート側のパス（例: `/home/me/work`）を書きます。
- `hide`: そのウィンドウが最後にフォーカスしたウィンドウの間、Discord には何も表示されません。`mask`: ファイル名、言語、ワークスペース名を出さずに、`Editing a file` と VS Code のロゴだけを表示します。

### 「プレイ中」の名前を変える

表示される名前は、拡張機能が接続に使う Discord アプリケーションの名前です。別の名前にしたい場合は、次の手順で設定します。

1. [Discord Developer Portal](https://discord.com/developers/applications) で **New Application** を押し、表示したい名前（例: `VS Code`）でアプリケーションを作ります。
2. **General Information** の **Application ID** をコピーします。
3. `discordPresence.clientId` に貼り付けます。拡張機能が接続し直し、数秒で新しい名前に変わります。

Developer Portal でのほかの設定は不要です（アイコンは GitHub から読み込みます）。設定を空に戻すと「Visual Studio Code」に戻ります。

## コマンド

| コマンド | 説明 |
|---|---|
| **Discord Presence: Reconnect** | すぐに Discord へ接続し直す |
| **Discord Presence: Toggle** | `discordPresence.enabled` のオンとオフを切り替える（ワークスペースの設定に書かれていればそちら、なければユーザー設定） |
| **Discord Presence: Show Log** | ログを開く |

ログは **出力** パネルの **Discord Presence** で見られます。

## Discord に送る情報

送り先は、自分の PC で動いている Discord アプリだけです（ローカルの名前付きパイプ経由）。

- 開いているファイルの名前（例: `extension.ts`）
- 言語名
- ワークスペース名
- ウィンドウを開いた時刻

フルパス、ファイルの中身、Git の情報などは送りません。表示される内容は、あなたの Discord プロフィールを見られる人すべてに見えます。見せたくないものは、上の設定で隠してください。

拡張機能自体はネットワーク通信をしません。アイコンは、Discord がこのリポジトリから GitHub 経由で読み込みます。

## 開発

### 前提条件

- Node.js と npm
- Discord デスクトップアプリ（起動しておく）

### 手順

```bash
npm install
npm run compile
```

VS Code で `F5` を押すと、拡張機能を読み込んだ拡張機能開発ホストが開きます。

### npm スクリプト

| コマンド | 説明 |
|---|---|
| `npm run compile` | `tsc` で `out/` にビルドする |
| `npm run watch` | 変更のたびにビルドする |
| `npm run lint` | ESLint |
| `npm test` | 拡張機能ホストでユニットテストを実行する |
| `npm run generate:icons` | devicon から `assets/icons/*.png` を作り直す（Chrome または Edge が必要） |

### パッケージ化

```bash
npx @vscode/vsce@4.0.0 package
```

### 仕様書

- [docs/requirements.md](docs/requirements.md): 表示のルール、設定、コマンド、複数ウィンドウの動き
- [docs/discord-ipc.md](docs/discord-ipc.md): この拡張機能での Discord IPC の使い方

## クレジット

- 言語アイコンと VS Code のロゴ: [devicon](https://github.com/devicons/devicon) v2.17.0、MIT ライセンス（[assets/icons/LICENSE-devicon.txt](assets/icons/LICENSE-devicon.txt)）をPNG に変換して使用しています。
- 各ロゴは、それぞれの持ち主の商標です。Visual Studio Code は Microsoft の商標です。この拡張機能は Microsoft および Discord とは関係がなく、承認も受けていません。

## ライセンス

[MIT License](LICENSE)
