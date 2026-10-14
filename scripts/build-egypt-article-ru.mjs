/**
 * Optional: regenerates egypt-fields-desert-oasis-2026-ru.html from article/egypt-fields-2026-source-ru.txt
 * (plain layout). The live RU page is hand-authored with styles/egypt-ru-article.css — do not overwrite by accident.
 *
 * Run: FORCE_REGEN_EGYPT_RU=1 node scripts/build-egypt-article-ru.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

if (process.env.FORCE_REGEN_EGYPT_RU !== '1') {
	console.log(
		'Skipping RU generator: live page is hand-authored. Set FORCE_REGEN_EGYPT_RU=1 to rebuild from article/egypt-fields-2026-source-ru.txt',
	);
	process.exit(0);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Cyrillic А.–Д. subsection markers */
const reCyrSubsection = /^[\u0410\u0411\u0412\u0413\u0414]\.\s/u;

const reChallengeH3 = /^(Водный стресс|Засоление|Урбанизация|Двойной удар)/;

const reAgriBullet = /^(Гигантского|Жёсткого|Транзитный)/;

function parseTabTable(bodyLines, startIdx) {
	let i = startIdx;
	const first = bodyLines[i]?.trim() ?? '';
	if (!first.startsWith('Культура')) return null;
	const rows = [];
	while (i < bodyLines.length) {
		const L = bodyLines[i].trim();
		if (!L) break;
		if (L.startsWith('Парадокс')) break;
		const cells = L.split(/\t+/).map((c) => c.trim());
		if (cells.length < 2) break;
		rows.push(cells);
		i++;
	}
	if (rows.length < 2) return null;
	return { rows, endIdx: i };
}

function tableHtml(rows) {
	const [head, ...body] = rows;
	let h = '<div class="article-table-wrap">\n<table class="article-table article-table--wide">\n<thead><tr>';
	for (const c of head) h += `<th>${esc(c)}</th>`;
	h += '</tr></thead>\n<tbody>\n';
	for (const r of body) {
		h += '<tr>';
		for (const c of r) h += `<td>${esc(c)}</td>`;
		h += '</tr>\n';
	}
	h += '</tbody></table>\n</div>\n';
	return h;
}

const raw = fs.readFileSync(path.join(root, 'article/egypt-fields-2026-source-ru.txt'), 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');
const title = lines[0].trim();
const deck = lines[1].trim();
const dateStr = lines[2].trim();
const bodyLines = lines.slice(4);

function buildArticleInnerHtml() {
	let html = '';
	let i = 0;
	while (i < bodyLines.length) {
		const t = bodyLines[i].trim();
		if (!t) {
			i++;
			continue;
		}
		if (/^\d+\.\s/.test(t)) {
			html += `<h2>${esc(t)}</h2>\n`;
			i++;
			continue;
		}
		if (reCyrSubsection.test(t)) {
			html += `<h3>${esc(t)}</h3>\n`;
			i++;
			continue;
		}
		if (/^Заключение:\s*/.test(t)) {
			html += `<h2>${esc(t)}</h2>\n`;
			i++;
			continue;
		}
		if (reChallengeH3.test(t)) {
			html += `<h3>${esc(t)}</h3>\n`;
			i++;
			continue;
		}
		const tbl = parseTabTable(bodyLines, i);
		if (tbl) {
			html += tableHtml(tbl.rows);
			i = tbl.endIdx;
			continue;
		}
		if (t.includes(' → ') && t.length < 300) {
			html += '<ul>\n';
			while (i < bodyLines.length) {
				const L = bodyLines[i].trim();
				if (!L || !L.includes(' → ')) break;
				html += `<li>${esc(L)}</li>\n`;
				i++;
			}
			html += '</ul>\n';
			continue;
		}
		if (reAgriBullet.test(t)) {
			html += '<ul>\n';
			while (i < bodyLines.length) {
				const L = bodyLines[i].trim();
				if (!L || !reAgriBullet.test(L)) break;
				html += `<li>${esc(L)}</li>\n`;
				i++;
			}
			html += '</ul>\n';
			continue;
		}
		const parts = [];
		while (i < bodyLines.length) {
			const L = bodyLines[i].trim();
			if (!L) break;
			if (/^\d+\.\s/.test(L)) break;
			if (reCyrSubsection.test(L)) break;
			if (/^Заключение:\s*/.test(L)) break;
			if (reChallengeH3.test(L)) break;
			if (L.startsWith('Культура')) break;
			if (L.includes(' → ') && L.length < 300) break;
			if (reAgriBullet.test(L)) break;
			parts.push(L);
			i++;
		}
		html += `<p>${esc(parts.join(' '))}</p>\n`;
	}
	return html;
}

const inner = buildArticleInnerHtml();

const full = `<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${esc(title)} | Furrow Markets</title>
	<meta name="description" content="${esc(deck)}">
	<link rel="stylesheet" href="styles/article.css">
</head>
<body>

<nav class="article-nav">
	<a href="/" class="article-logo">FURROW MARKETS</a>
	<div class="article-nav-right">
		<div class="article-nav-links">
			<a href="/">Главная</a>
			<a href="/ukraine-harvest-war">Украина · урожай 2026</a>
			<a href="/egypt-fields-desert-oasis-2026-ru" class="active">Египет</a>
			<a href="/sponsor">Спонсорство</a>
			<a href="/register">Регистрация</a>
		</div>
		<div class="article-lang-switch">
			<a href="/egypt-fields-desert-oasis-2026">EN</a>
			<a href="/egypt-fields-desert-oasis-2026-ru" class="active">RU</a>
		</div>
	</div>
</nav>

<article class="article-container">
	<div class="article-kicker">MENA · НИЛ · АНАЛИТИКА</div>
	<h1>${esc(title)}</h1>
	<p class="article-lead"><strong>${esc(deck)}</strong></p>
	<div class="article-meta">
		<span>${esc(dateStr)}</span>
		<span>12 мин</span>
		<span>Furrow Markets Desk</span>
	</div>

${inner}
	<p class="article-byline"><em>— Furrow Markets Desk</em></p>
</article>

<footer class="article-footer">
	<p>© 2026 Furrow Markets — агрорыночная аналитика</p>
	<p><a href="mailto:hello@furrowmarkets.com">hello@furrowmarkets.com</a> · <a href="/egypt-fields-desert-oasis-2026">English</a> · Русский</p>
</footer>

<script src="scripts/furrow-analytics.js" defer></script>
</body>
</html>
`;

const outPath = path.join(root, 'egypt-fields-desert-oasis-2026-ru.html');
fs.writeFileSync(outPath, full, 'utf8');
console.log('Wrote', outPath);
