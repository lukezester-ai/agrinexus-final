import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = join(root, 'index.html');
let h = readFileSync(p, 'utf8');

const subs = [
	[
		'<motion class="lead-eyebrow">Daily Brief · Grains</motion>',
		'<div class="lead-eyebrow" data-i18n="home.lead.eyebrow">Daily Brief · Grains</div>',
	],
];

// use div consistently
const pairs = [
	[
		/<a href="#">Wheat Surges to Six-Month High as Russian Export Tax Bites Black Sea Trade<\/a>/,
		'<a href="article/sample.html" data-i18n="home.lead.title">Wheat Surges to Six-Month High as Russian Export Tax Bites Black Sea Trade</a>',
	],
	[
		/<p class="lead-deck">\s*Moscow's revised export levy[\s\S]*?European mills\.\s*<\/p>/,
		`<p class="lead-deck" data-i18n="home.lead.deck">Moscow's revised export levy lifts CBOT wheat futures 4.2% in a week; Argentine drought and weak Russian harvest reinforce a bullish short-term outlook for European mills.</p>`,
	],
	['<span class="author">By Furrow Markets Desk</span>', '<span class="author" data-i18n="home.lead.author">By Furrow Markets Desk</span>'],
	['<span>6 min read</span>', '<span data-i18n="home.lead.readtime">6 min read</span>'],
	['<span>May 18, 2026 · 12:45 GMT</span>', '<span data-i18n="home.lead.date">May 18, 2026 · 12:45 GMT</span>'],
	[
		/<div class="lead-body">[\s\S]*?<\/motion>\s*<a href="#" class="lead-cta">Continue reading →<\/a>/,
		`<motion class="lead-body">
        <p data-i18n="home.lead.p1">Wheat prices broke through a six-month resistance level on Friday...</p>
        <p data-i18n="home.lead.p2">European mills, already operating with thin inventory cover...</p>
      </motion>
      <a href="article/sample.html" class="lead-cta" data-i18n="home.lead.cta">Continue reading →</a>`,
	],
];

let n = 0;
for (const [from, to] of pairs) {
	if (typeof from === 'string') {
		if (h.includes(from)) {
			h = h.replace(from, to);
			n++;
		}
	} else if (from.test(h)) {
		h = h.replace(from, to);
		n++;
	}
}

h = h.replace(
	'<div class="lead-eyebrow">Daily Brief · Grains</div>',
	'<div class="lead-eyebrow" data-i18n="home.lead.eyebrow">Daily Brief · Grains</div>',
);

writeFileSync(p, h);
console.log('patched', n, 'blocks');
