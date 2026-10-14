import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIV = 'd' + 'i' + 'v';
for (const rel of ['index.html', 'article/sample.html', 'scripts/furrow-chat.js']) {
	const p = join(root, rel);
	let s = readFileSync(p, 'utf8');
	s = s.replace(/<\/?motion\b/g, (tag) => tag.replace('motion', DIV));
	s = s.replace(/createElement\('motion'\)/g, `createElement('${DIV}')`);
	writeFileSync(p, s);
	console.log('fixed', rel);
}
