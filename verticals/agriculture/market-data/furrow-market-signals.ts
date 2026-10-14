/**
 * Furrow marketing — delayed futures via Yahoo (self-contained, no agrinexus link).
 */

export type FurrowFutureQuote = {
	id: string;
	label: string;
	symbol: string;
	unit: string;
	price: number | null;
	currency: string;
	changePct: number | null;
	asOf: string;
};

export type FurrowMarketSignals = {
	updatedAt: string | null;
	futures: FurrowFutureQuote[];
	errors: { type: string; id: string; error: string }[];
	sources: string[];
};

const MARKET_TICKERS = [
	{ id: 'cbot_corn', label: 'CBOT corn (ZC=F)', symbol: 'ZC=F', unit: 'USD/bu' },
	{ id: 'cbot_wheat', label: 'CBOT wheat (ZW=F)', symbol: 'ZW=F', unit: 'USD/bu' },
	{ id: 'cbot_soy', label: 'CBOT soy (ZS=F)', symbol: 'ZS=F', unit: 'USD/bu' },
	{ id: 'baltic_dry', label: 'Baltic Dry (BDIY)', symbol: 'BDIY', unit: 'index' },
] as const;

let memoryCache: { payload: FurrowMarketSignals; at: number } | null = null;
const TTL_MS = 15 * 60 * 1000;

async function fetchYahooQuote(ticker: (typeof MARKET_TICKERS)[number]): Promise<FurrowFutureQuote> {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.symbol)}?interval=1d&range=5d`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Furrow-Markets/1.0 (+https://furrowmarkets.com)' },
	});
	if (!res.ok) throw new Error(`Yahoo ${res.status}`);
	const json = (await res.json()) as {
		chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string; regularMarketTime?: number }; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
	};
	const result = json.chart?.result?.[0];
	const meta = result?.meta;
	const closes = result?.indicators?.quote?.[0]?.close?.filter((v): v is number => v != null) || [];
	const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
	const last = closes[closes.length - 1] ?? meta?.regularMarketPrice ?? null;
	const changePct =
		prev != null && last != null ? Math.round(((last - prev) / prev) * 10000) / 100 : null;
	return {
		id: ticker.id,
		label: ticker.label,
		symbol: ticker.symbol,
		unit: ticker.unit,
		price: last ?? null,
		currency: meta?.currency || 'USD',
		changePct,
		asOf: meta?.regularMarketTime
			? new Date(meta.regularMarketTime * 1000).toISOString()
			: new Date().toISOString(),
	};
}

export async function refreshFurrowMarketSignals(): Promise<FurrowMarketSignals> {
	const errors: FurrowMarketSignals['errors'] = [];
	const futures: FurrowFutureQuote[] = [];

	for (const ticker of MARKET_TICKERS) {
		try {
			futures.push(await fetchYahooQuote(ticker));
		} catch (err) {
			errors.push({
				type: 'futures',
				id: ticker.id,
				error: err instanceof Error ? err.message : 'fetch failed',
			});
		}
	}

	const payload: FurrowMarketSignals = {
		updatedAt: new Date().toISOString(),
		futures,
		errors,
		sources: ['finance.yahoo.com (delayed, unofficial)'],
	};

	memoryCache = { payload, at: Date.now() };
	return payload;
}

export async function getFurrowMarketSignals(opts?: { force?: boolean }): Promise<FurrowMarketSignals> {
	if (!opts?.force && memoryCache && Date.now() - memoryCache.at < TTL_MS) {
		return memoryCache.payload;
	}
	return refreshFurrowMarketSignals();
}

/** Compact text block for LLM context / tool results */
export function formatSignalsForAgent(signals: FurrowMarketSignals, lang: 'en' | 'bg'): string {
	const en = lang === 'en';
	if (!signals.futures.length) {
		return en
			? 'Market signals unavailable right now (delayed CBOT/Baltic via Yahoo).'
			: 'Пазарните сигнали са недостъпни в момента (забавени CBOT/Baltic през Yahoo).';
	}
	const lines = signals.futures.map((f) => {
		const price =
			f.price != null
				? f.unit === 'USD/bu'
					? `$${Number(f.price).toFixed(2)}/bu`
					: String(f.price)
				: '—';
		const delta = f.changePct != null ? `${f.changePct > 0 ? '+' : ''}${f.changePct}%` : '—';
		return `${f.label}: ${price} (${delta} d/d)`;
	});
	const head = en
		? `Delayed market snapshot (as of ${signals.updatedAt?.slice(0, 19) ?? 'n/a'} UTC):`
		: `Забавен пазарен снимък (${signals.updatedAt?.slice(0, 19) ?? 'n/a'} UTC):`;
	return `${head}\n${lines.join('\n')}\n\n${en ? 'Disclaimer: not investment advice. Verify with official sources.' : 'Не е инвестиционен съвет. Проверявайте официални източници.'}`;
}
