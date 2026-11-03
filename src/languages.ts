import type { LanguageInfo } from './presence/activityBuilder';

// icon は assets/icons/<icon>.png のファイル名。devicon のアイコン名に合わせている
export const LANGUAGES: Record<string, LanguageInfo> = {
	astro: { name: 'Astro', icon: 'astro' },
	bat: { name: 'Batch' },
	c: { name: 'C', icon: 'c' },
	cpp: { name: 'C++', icon: 'cplusplus' },
	csharp: { name: 'C#', icon: 'csharp' },
	css: { name: 'CSS', icon: 'css3' },
	dart: { name: 'Dart', icon: 'dart' },
	dockercompose: { name: 'Docker Compose', icon: 'docker' },
	dockerfile: { name: 'Dockerfile', icon: 'docker' },
	go: { name: 'Go', icon: 'go' },
	html: { name: 'HTML', icon: 'html5' },
	java: { name: 'Java', icon: 'java' },
	javascript: { name: 'JavaScript', icon: 'javascript' },
	javascriptreact: { name: 'JavaScript React', icon: 'react' },
	json: { name: 'JSON', icon: 'json' },
	jsonc: { name: 'JSON with Comments', icon: 'json' },
	kotlin: { name: 'Kotlin', icon: 'kotlin' },
	lua: { name: 'Lua', icon: 'lua' },
	markdown: { name: 'Markdown', icon: 'markdown' },
	php: { name: 'PHP', icon: 'php' },
	plaintext: { name: 'Plain Text' },
	powershell: { name: 'PowerShell', icon: 'powershell' },
	python: { name: 'Python', icon: 'python' },
	r: { name: 'R', icon: 'r' },
	ruby: { name: 'Ruby', icon: 'ruby' },
	rust: { name: 'Rust', icon: 'rust' },
	sass: { name: 'Sass', icon: 'sass' },
	scss: { name: 'SCSS', icon: 'sass' },
	shellscript: { name: 'Shell Script', icon: 'bash' },
	sql: { name: 'SQL' },
	svelte: { name: 'Svelte', icon: 'svelte' },
	swift: { name: 'Swift', icon: 'swift' },
	typescript: { name: 'TypeScript', icon: 'typescript' },
	typescriptreact: { name: 'TypeScript React', icon: 'react' },
	vue: { name: 'Vue', icon: 'vuejs' },
	xml: { name: 'XML', icon: 'xml' },
	yaml: { name: 'YAML', icon: 'yaml' },
};

export function getLanguage(languageId: string): LanguageInfo {
	// languageId が constructor などのプロトタイプのキーと一致しても誤って拾わないようにする
	return Object.hasOwn(LANGUAGES, languageId) ? LANGUAGES[languageId] : { name: languageId };
}
