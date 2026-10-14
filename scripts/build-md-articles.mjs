import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const buildArticle = (mdFile, outFile, lang, title, deck, kicker) => {
    const raw = fs.readFileSync(path.join(root, mdFile), 'utf8');
    const inner = marked.parse(raw);
    
    const full = `<!DOCTYPE html>
<html lang="${lang}">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} | Furrow Markets</title>
	<meta name="description" content="${deck}">
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
			<a href="/egypt-agriculture-analysis-en" class="${lang === 'en' ? 'active' : ''}">EN</a>
			<a href="/egypt-agriculture-analysis-ru" class="${lang === 'ru' ? 'active' : ''}">RU</a>
		</div>
	</div>
</nav>

<article class="article-container">
	<div class="article-kicker">${kicker}</div>
	${inner}
	<p class="article-byline"><em>— Furrow Markets Desk</em></p>
</article>

<footer class="article-footer">
	<p>© 2026 Furrow Markets — Agricultural market intelligence</p>
	<p><a href="mailto:hello@furrowmarkets.com">hello@furrowmarkets.com</a> · English · <a href="/egypt-agriculture-analysis-ru">Русский</a></p>
</footer>

<script src="scripts/furrow-analytics.js" defer></script>
</body>
</html>`;

    const outPath = path.join(root, outFile);
    fs.writeFileSync(outPath, full, 'utf8');
    console.log('Wrote', outPath);
};

if (fs.existsSync(path.join(root, 'article/Egypt_Agriculture_Analysis_EN.md'))) {
// For EN
buildArticle(
    'article/Egypt_Agriculture_Analysis_EN.md',
    'egypt-agriculture-analysis-en.html',
    'en',
    "Egypt's Fields: The Desert Oasis That Feeds 108 Million People",
    "Geography, cycles, and trade paradoxes of the world's largest wheat importer",
    "MENA · NILE BASIN · ANALYSIS"
);
}

if (fs.existsSync(path.join(root, 'article/Egypt_Agriculture_Analysis_RU.md'))) {
// For RU
buildArticle(
    'article/Egypt_Agriculture_Analysis_RU.md',
    'egypt-agriculture-analysis-ru.html',
    'ru',
    "Поля Египта: пустынный оазис, который кормит 108 миллионов человек",
    "География, циклы и торговые парадоксы крупнейшего в мире импортёра зерна",
    "БЛИЖНИЙ ВОСТОК И СЕВЕРНАЯ АФРИКА · АНАЛИТИКА"
);
}

// US/Canada EN
buildArticle(
    'article/US_Canada_EU_Wheat_Analysis_EN.md',
    'us-canada-wheat-trade-war-en.html',
    'en',
    "The U.S. vs. Canada in May 2026: Trade War and a Wheat Earthquake",
    "Trade War, Political Realignment, and a Wheat Earthquake — With Europe Caught in the Middle",
    "NORTH AMERICA · TRADE · ANALYSIS"
);

// US/Canada RU
buildArticle(
    'article/US_Canada_EU_Wheat_Analysis_RU.md',
    'us-canada-wheat-trade-war-ru.html',
    'ru',
    "США против Канады: торговая война и пшеничное землетрясение",
    "Торговая война, политическая перегруппировка и пшеничное землетрясение",
    "СЕВЕРНАЯ АМЕРИКА · ТОРГОВЛЯ · АНАЛИТИКА"
);

