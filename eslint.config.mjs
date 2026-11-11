import typescriptEslint from "typescript-eslint";

const NETWORK_MESSAGE =
    "拡張機能自身は通信しない。Discord とは src/ipc/discordIpc.ts の名前付きパイプ (net) だけでやり取りする";
const PRIVACY_MESSAGE =
    "Discord に送るのは docs/requirements.md §4 の項目だけ。フルパスやファイルの中身を扱わない";

const networkModules = ["http", "https", "http2", "dgram", "tls"].flatMap((name) => [name, `node:${name}`]);
const network = [
    ...networkModules.map((name) => ({ name, message: NETWORK_MESSAGE })),
    ...["discord-rpc", "@xhayper/discord-rpc"].map((name) => ({
        name,
        message: "Discord IPC は Node.js の組み込みモジュールだけで実装する",
    })),
];
const pipe = ["net", "node:net"].map((name) => ({ name, message: NETWORK_MESSAGE }));

const platform = {
    selector: "MemberExpression[object.name='process'][property.name='platform']",
    message: "OS ごとの判断は src/ipc/getIpcPath.ts に集める",
};
const notification = {
    selector: "CallExpression[callee.property.name=/^show(Error|Warning)Message$/]",
    message: "Discord に接続できないのは通常の状態。通知を出さず、出力チャンネルに記録する",
};
const fullPath = { selector: "MemberExpression[property.name='fsPath']", message: PRIVACY_MESSAGE };
const fileContent = { selector: "CallExpression[callee.property.name='getText']", message: PRIVACY_MESSAGE };
const directActivity = {
    selector: "CallExpression[callee.property.name='setActivity']",
    message: "更新は presenceController.ts の debounce と throttle を通す (docs/discord-ipc.md §6)",
};

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },

    rules: {
        "@typescript-eslint/naming-convention": ["error", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/ban-ts-comment": "error",
        "@typescript-eslint/explicit-module-boundary-types": "error",
        // 接続エラーで reject した Promise を放置すると、未処理の例外として拡張機能ホストに出る
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",

        curly: "error",
        eqeqeq: "error",
        "no-throw-literal": "error",
        semi: "error",

        "no-restricted-globals": [
            "error",
            ...["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((name) => ({ name, message: NETWORK_MESSAGE })),
        ],
        "no-restricted-imports": ["error", { paths: [...network, ...pipe] }],
    },
}, {
    files: ["src/**/*.ts"],
    ignores: ["src/test/**"],
    rules: {
        "no-restricted-syntax": ["error", platform, notification, fullPath, fileContent, directActivity],
    },
}, {
    files: ["src/ipc/getIpcPath.ts"],
    rules: {
        "no-restricted-syntax": ["error", notification, fullPath, fileContent, directActivity],
    },
}, {
    // hiddenWorkspaces との照合にだけフォルダのパスを使う
    files: ["src/config.ts"],
    rules: {
        "no-restricted-syntax": ["error", platform, notification, fileContent, directActivity],
    },
}, {
    // PresenceController に送信関数として渡す配線
    files: ["src/extension.ts"],
    rules: {
        "no-restricted-syntax": ["error", platform, notification, fullPath, fileContent],
    },
}, {
    // fakeDiscord.ts は名前付きパイプのサーバーを立てる
    files: ["src/ipc/discordIpc.ts", "src/test/**"],
    rules: {
        "no-restricted-imports": ["error", { paths: network }],
    },
}, {
    // vscode はテストの外から差し替えられないため、単体テストするファイルには持ち込まない
    files: [
        "src/presence/activityBuilder.ts",
        "src/presence/connectionStatus.ts",
        "src/presence/hiddenWorkspaces.ts",
        "src/presence/workspaceName.ts",
        "src/ipc/frame.ts",
        "src/languages.ts",
    ],
    rules: {
        "no-restricted-imports": ["error", {
            paths: [
                ...network,
                ...pipe,
                { name: "vscode", message: "このファイルは vscode に依存させず、値を受け取って値を返す" },
            ],
            patterns: [{
                group: ["**/config"],
                message: "config.ts は vscode を import している",
            }],
        }],
    },
}];
