import { yahooFinance } from '../yahoo-finance-client.js';

type QuoteLike = {
	symbol?: string;
	shortName?: string;
	longName?: string;
	regularMarketPrice?: number | null;
	regularMarketChange?: number | null;
	regularMarketChangePercent?: number | null;
	currency?: string;
};

/** Кратък текстов блок за LLM: реални delayed котировки от Yahoo (фючърси). */
export async function fetchMarketSnapshotForLlm(): Promise<string> {
	const symbols = ['ZW=F', 'ZC=F', 'ZS=F', 'ZL=F'] as const;
	try {
		const raw = await yahooFinance.quote([...symbols]);
		const arr: QuoteLike[] = Array.isArray(raw) ? (raw as QuoteLike[]) : [raw as QuoteLike];
		const lines = arr.map((q) => {
			const label = q.shortName || q.longName || q.symbol || '—';
			const p = q.regularMarketPrice;
			const ch = q.regularMarketChange;
			const pct = q.regularMarketChangePercent;
			const cur = q.currency || 'USD';
			if (p == null) return `${label}: n/a`;
			const tail =
				ch != null && pct != null
					? ` (chg ${ch.toFixed(2)} ${cur}, ${pct.toFixed(2)}%)`
					: '';
			return `${label} [${q.symbol}]: ${p} ${cur}${tail}`;
		});
		return [
			'=== MARKET SNAPSHOT (Yahoo Finance, delayed; not investment advice) ===',
			...lines,
			'=== END SNAPSHOT ===',
		].join('\n');
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return `=== MARKET SNAPSHOT ===\nUnavailable (${msg}). Do not invent prices.\n=== END ===`;
	}
}
