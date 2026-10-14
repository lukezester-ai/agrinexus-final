/**
 * Writes Furrow static article index export to furrow-github/agridirect/data/
 * (machine-readable bundle; editorial longreads live under /archive).
 *
 * Local (default): reads articles.json + prices.json from the path in AGRIDIRECT_DATA_DIR
 * (default path in code: sibling `../agrinexus-final-main/market-data/data` when present).
 *   node scripts/sync-agridirect-articles.mjs
 *   AGRIDIRECT_DATA_DIR=../other/path/market-data/data node scripts/sync-agridirect-articles.mjs
 *
 * Remote (Vercel Deployment Protection): set bypass secret in project → Automation,
 * then:
 *   AGRIDIRECT_REMOTE=https://your-deployment.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=xxx node scripts/sync-agridirect-articles.mjs
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outDir = join(root, 'agridirect', 'data');
const outFile = join(outDir, 'articles-export.json');

const remote = (process.env.AGRIDIRECT_REMOTE || '').replace(/\/+$/, '');
const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim();
const dataDir = (
	process.env.AGRIDIRECT_DATA_DIR ||
	join(root, '..', 'agrinexus-final-main', 'market-data', 'data')
).replace(/\/+$/, '');

function bypassHeaders() {
	if (!bypass) return {};
	return { 'x-vercel-protection-bypass': bypass };
}

async function fetchJson(url) {
	const res = await fetch(url, { headers: { ...bypassHeaders() } });
	const text = await res.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = { _parseError: true, raw: text.slice(0, 500) };
	}
	if (!res.ok) {
		const err = new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status} ${url}`);
		err.status = res.status;
		err.body = data;
		throw err;
	}
	return data;
}

async function buildFromLocal() {
	const articlesPath = join(dataDir, 'articles.json');
	const pricesPath = join(dataDir, 'prices.json');
	const [articlesRaw, pricesRaw] = await Promise.all([
		readFile(articlesPath, 'utf-8'),
		readFile(pricesPath, 'utf-8'),
	]);
	const articles = JSON.parse(articlesRaw);
	const prices = JSON.parse(pricesRaw);
	if (!Array.isArray(articles)) throw new Error('articles.json must be an array');
	if (!Array.isArray(prices)) throw new Error('prices.json must be an array');
	const items = articles.map((article) => ({
		article,
		prices: prices.filter((p) => p.articleId === article.id),
	}));
	return { articles, items };
}

async function buildFromRemote() {
	const base = remote;
	const listUrl = `${base}/api/market-data/articles`;
	const data = await fetchJson(listUrl);
	const articles = data.articles || [];
	const items = [];
	for (const a of articles) {
		const id = a.id;
		if (!id) continue;
		const detailUrl = `${base}/api/market-data/articles/${encodeURIComponent(id)}`;
		const detail = await fetchJson(detailUrl);
		items.push({
			article: detail.article || a,
			prices: detail.prices || [],
		});
	}
	return { articles, items };
}

async function main() {
	let source;
	let articles;
	let items;
	if (remote) {
		source = remote;
		({ articles, items } = await buildFromRemote());
	} else {
		source = dataDir;
		({ articles, items } = await buildFromLocal());
	}

	const payload = {
		generatedAt: new Date().toISOString(),
		source,
		count: items.length,
		items,
	};

	await mkdir(outDir, { recursive: true });
	await writeFile(outFile, JSON.stringify(payload, null, 2), 'utf-8');
	console.log(`Wrote ${items.length} article(s) → ${outFile}`);
}

main().catch((e) => {
	console.error(e.message || e);
	if (e.status === 401) {
		console.error(
			'\nTip: Vercel Deployment Protection blocks anonymous fetch. Add Automation bypass secret on the target Vercel project, then:\n  VERCEL_AUTOMATION_BYPASS_SECRET=... AGRIDIRECT_REMOTE=https://....vercel.app node scripts/sync-agridirect-articles.mjs',
		);
	}
	process.exit(1);
});
