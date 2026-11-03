import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getLanguage, LANGUAGES } from '../languages';

// テストは out/test/ から実行される
const ICONS_DIR = path.resolve(__dirname, '../../assets/icons');

suite('languages', () => {
	test('returns the display name and icon for a known languageId', () => {
		assert.deepStrictEqual(getLanguage('typescriptreact'), { name: 'TypeScript React', icon: 'react' });
	});

	test('falls back to the languageId without an icon', () => {
		assert.deepStrictEqual(getLanguage('fortran-modern'), { name: 'fortran-modern' });
	});

	test('does not pick up prototype keys', () => {
		assert.deepStrictEqual(getLanguage('constructor'), { name: 'constructor' });
	});

	test('has a PNG in assets/icons for every icon, including the VS Code logo', () => {
		const icons = new Set(Object.values(LANGUAGES).flatMap((language) => (language.icon ? [language.icon] : [])));
		icons.add('vscode');
		const missing = [...icons].filter((icon) => !fs.existsSync(path.join(ICONS_DIR, `${icon}.png`)));
		assert.deepStrictEqual(missing, [], 'run npm run generate:icons');
	});
});
