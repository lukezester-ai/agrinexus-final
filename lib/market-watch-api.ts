import { handleMarketQuotesGet } from './market-quotes-handler.js';
import { persistMarketWatchSnapshot } from './market-watch-persist.js';
import { loadMarketWatchState } from './market-watch-state.js';
import type { MarketWatchPayloadV1 } from './market-watch-types.js';

/** Публичен изглед без пълните вериги от цени (по-малък JSON). */
export function stripInternalMarketWatchFields(w: MarketWatchPayloadV1): Record<string, unknown> {
	const symbolStats: Record<string, unknown> = {};
	for (const [sym, row] of Object.entries(w.symbolStats)) {
		const { closes: _c, ...rest } = row;
		symbolStats[sym] = rest;
	}
	return {
		persistCount: w.persistCount,
		lastPersistAt: w.lastPersistAt,
		symbolStats,
		snapshotsMeta: w.snapshots.slice(-6).map(s => ({ at: s.at, rows: s.rows.length })),
		marketModels: w.marketModels ?? [],
		lastInsights: w.lastInsights,
	};
}

export async function handleMarketWatchGet(): Promise<Record<string, unknown>> {
	const quotes = await handleMarketQuotesGet();
	if (quotes.ok && quotes.mode === 'live') {
		void persistMarketWatchSnapshot(quotes.quotes, quotes.fetchedAt);
	}
	const watch = await loadMarketWatchState();
	return {
		...quotes,
		watch: stripInternalMarketWatchFields(watch),
	};
}
