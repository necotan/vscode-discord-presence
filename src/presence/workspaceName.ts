import * as path from 'path';

const WORKSPACE_FILE_EXTENSION = '.code-workspace';

export interface WorkspaceLocation {
	scheme: string;
	path: string;
}

// vscode.workspace.name は表示用のラベルで Remote の接続先などが付くため、場所から名前を作る（requirements.md 5.1）
export function resolveWorkspaceName(
	workspaceFile: WorkspaceLocation | undefined,
	folders: readonly WorkspaceLocation[],
): string | undefined {
	// 未保存のマルチルートには名前がなく、代わりにフォルダ名を出すと requirements.md §4 の送信対象を超える
	if (workspaceFile?.scheme === 'untitled') {
		return undefined;
	}
	const name = workspaceFile
		? path.posix.basename(workspaceFile.path, WORKSPACE_FILE_EXTENSION)
		: path.posix.basename(folders[0]?.path ?? '');
	return name || undefined;
}
