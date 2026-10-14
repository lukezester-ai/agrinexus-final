/**
 * Generates egypt-fields-desert-oasis-2026.html from article/egypt-fields-2026-source.txt
 * Run from repo root: node scripts/build-egypt-article.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const raw = fs.readFileSync(path.join(root, 'article/egypt-fields-2026-source.txt'), 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');
const title = lines[0].trim();
const deck = lines[1].trim();
const dateStr = lines[2].trim();
const bodyLines = lines.slice(4);

const yieldTable = `
<div class="article-table-wrap">
<table class="article-table article-table--wide">
<thead><tr><th>Crop</th><th>Egypt (t/ha)</th><th>Global avg</th><th>Note</th></tr></thead>
<tbody>
<tr><td>Wheat</td><td>6.8</td><td>3.5</td><td>High due to irrigation, but expensive</td></tr>
<tr><td>Rice</td><td>9.5–10.0</td><td>4.6</td><td>Among the highest in Africa</td></tr>
<tr><td>Maize</td><td>7.5</td><td>5.8</td><td>Feed-focused</td></tr>
<tr><td>Cotton (seed)</td><td>1.2</td><td>0.9</td><td>Planted areas are tiny</td></tr>
</tbody></table>
</div>
`;

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
		if (/^[A-E]\.\s/.test(t)) {
			html += `<h3>${esc(t)}</h3>\n`;
			i++;
			continue;
		}
		if (/^Conclusion:\s/.test(t)) {
			html += `<h2>${esc(t)}</h2>\n`;
			i++;
			continue;
		}
		if (/^(Water stress|Salinization|Urbanization|The energy\/fertilizer)/.test(t)) {
			html += `<h3>${esc(t)}</h3>\n`;
			i++;
			continue;
		}
		if (t.startsWith('CropEgypt')) {
			html += yieldTable;
			i++;
			continue;
		}
		if (t.includes(' → ') && t.length < 260) {
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
		if (/^A gigantic customer|^A fierce competitor|^A transit hub/.test(t)) {
			html += '<ul>\n';
			while (i < bodyLines.length) {
				const L = bodyLines[i].trim();
				if (!L || !/^A (gigantic|fierce|transit)/.test(L)) break;
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
			if (/^[A-E]\.\s/.test(L)) break;
			if (/^Conclusion:\s/.test(L)) break;
			if (/^(Water stress|Salinization|Urbanization|The energy\/fertilizer)/.test(L)) break;
			if (L.startsWith('CropEgypt')) break;
			if (L.includes(' → ') && L.length < 260) break;
			if (/^A (gigantic|fierce|transit)/.test(L)) break;
			parts.push(L);
			i++;
		}
		html += `<p>${esc(parts.join(' '))}</p>\n`;
	}
	return html;
}

const inner = buildArticleInnerHtml();

const full = `<!DOCTYPE html>
<html lang="en">
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
			<a href="/">Home</a>
			<a href="/ukraine-harvest-war">Ukraine Harvest 2026</a>
			<a href="/egypt-fields-desert-oasis-2026" class="active">Egypt</a>
			<a href="/archive">Archive</a>
			<a href="/sponsor">Sponsor</a>
			<a href="/register">Register</a>
		</div>
		<div class="article-lang-switch">
			<a href="/egypt-fields-desert-oasis-2026" class="active">EN</a>
			<a href="/egypt-fields-desert-oasis-2026-ru">RU</a>
		</div>
	</div>
</nav>

<article class="article-container">
	<div class="article-kicker">MENA · NILE BASIN · ANALYSIS</div>
	<h1>${esc(title)}</h1>
	<p class="article-lead"><strong>${esc(deck)}</strong></p>
	<div class="article-meta">
		<span>${esc(dateStr)}</span>
		<span>12 min read</span>
		<span>Furrow Markets Desk</span>
	</div>

${inner}
	<p class="article-byline"><em>— Furrow Markets Desk</em></p>
</article>

<footer class="article-footer">
	<p>© 2026 Furrow Markets — Agricultural market intelligence</p>
	<p><a href="mailto:hello@furrowmarkets.com">hello@furrowmarkets.com</a> · English · <a href="/egypt-fields-desert-oasis-2026-ru">Русский</a></p>
</footer>

<script src="scripts/furrow-analytics.js" defer></script>
</body>
</html>
`;

const outPath = path.join(root, 'egypt-fields-desert-oasis-2026.html');
fs.writeFileSync(outPath, full, 'utf8');
console.log('Wrote', outPath);
