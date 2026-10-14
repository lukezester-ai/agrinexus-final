import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildFile(sourceName, outName, lang, otherLangUrl, otherLangName) {
    const raw = fs.readFileSync(path.join(root, 'article', sourceName), 'utf8');
    
    // Extract title (first line)
    const lines = raw.split('\n');
    let title = 'Global Corn Producers Analysis';
    if (lines[0].startsWith('# ')) {
        title = lines[0].replace('# ', '').trim();
    }
    
    // Parse the markdown
    const htmlContent = marked.parse(raw);
    
    const kicker = lang === 'en' ? 'GLOBAL · ANALYSIS' : 'ГЛОБАЛЬНО · АНАЛИТИКА';
    const footerOtherLang = lang === 'en' ? 'Русский' : 'English';
    const otherLangLink = lang === 'en' ? '/global-corn-producers-analysis-ru' : '/global-corn-producers-analysis-en';
    
    const full = `<!DOCTYPE html>
<html lang="${lang}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>\${esc(title)} | Furrow Markets</title>
	<meta name="description" content="Global Corn Producers Analysis">
	<link rel="stylesheet" href="styles/article.css">
</head>
<body>

<nav class="article-nav">
	<a href="/" class="article-logo">FURROW MARKETS</a>
	<div class="article-nav-right">
		<div class="article-nav-links">
			<a href="/">Home</a>
			<a href="/archive">Archive</a>
			<a href="/sponsor">Sponsor</a>
			<a href="/register">Register</a>
		</div>
		<div class="article-lang-switch">
			<a href="/\${outName.replace('.html', '')}" class="active">\${lang.toUpperCase()}</a>
			<a href="\${otherLangUrl}">\${otherLangName}</a>
		</div>
	</div>
</nav>

<article class="article-container">
	<div class="article-kicker">\${kicker}</div>
	
	<div class="article-meta">
		<span>19 May 2026</span>
		<span>10 min read</span>
		<span>Furrow Markets Desk</span>
	</div>

\${htmlContent}
	<p class="article-byline"><em>— Furrow Markets Desk</em></p>
</article>

<footer class="article-footer">
	<p>© 2026 Furrow Markets — Agricultural market intelligence</p>
	<p><a href="mailto:hello@furrowmarkets.com">hello@furrowmarkets.com</a> · English · <a href="\${otherLangLink}">\${footerOtherLang}</a></p>
</footer>

<script src="scripts/furrow-analytics.js" defer></script>
</body>
</html>`;

    const outPath = path.join(root, outName);
    fs.writeFileSync(outPath, full, 'utf8');
    console.log('Wrote', outPath);
}

// Build EN
buildFile('Global_Corn_Producers_Analysis_EN.md', 'global-corn-producers-analysis-en.html', 'en', '/global-corn-producers-analysis-ru', 'RU');

// Build RU
buildFile('Global_Corn_Producers_Analysis_RU.md', 'global-corn-producers-analysis-ru.html', 'ru', '/global-corn-producers-analysis-en', 'EN');
