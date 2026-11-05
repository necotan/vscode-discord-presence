export interface WorkspaceIdentity {
	names: readonly string[];
	paths: string[];
}

export function isHiddenWorkspace(workspace: WorkspaceIdentity, entries: readonly string[]): boolean {
	const names = workspace.names.map((name) => name.toLowerCase());
	const paths = workspace.paths.map(normalizePath);
	return entries.some((raw) => {
		const entry = raw.trim();
		if (!entry) {
			return false;
		}
		// ワークスペース名は区切り文字を含まないため、区切り文字の有無で名前とパスを見分ける
		if (!/[\\/]/.test(entry)) {
			return names.includes(entry.toLowerCase());
		}
		const base = normalizePath(entry);
		return paths.some((path) => path === base || path.startsWith(`${base}/`));
	});
}

// Remote のパスは Windows 上の fsPath で \ 区切りになるため / にそろえる
// 大文字と小文字を区別しないのは、出してはいけないものが出るより隠しすぎるほうが安全なため
function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
