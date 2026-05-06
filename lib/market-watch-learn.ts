import type { MarketQuotePayload } from './market-quotes-handler.js';
import type { MarketSymbolRollStats, MarketWatchPayloadV1 } from './market-watch-types.js';

const MAX_SNAPSHOTS = 52;
const MAX_CLOSES = 40;

function avg(a: number[]): number {
	if (a.length === 0) return 0;
	return a.reduce((s, x) => s + x, 0) / a.length;
}

export function snapshotThrottleMs(): number {
	const n = Number(process.env.MARKET_WATCH_SNAPSHOT_MIN_MS);
	return Number.isFinite(n) && n >= 60_000 ? Math.floor(n) : 900_000;
}

export function shouldThrottleMarketWatchPersist(prev: MarketWatchPayloadV1, nowMs: number): boolean {
	const last = prev.lastPersistAt ? Date.parse(prev.lastPersistAt) : NaN;
	if (!Number.isFinite(last)) return false;
	return nowMs - last < snapshotThrottleMs();
}

/** Обновява ролинг статистика и история от последни котировки (не увеличава persistCount — прави се отвън). */
export function mergeQuotesIntoMarketWatch(
	prev: MarketWatchPayloadV1,
	quotes: MarketQuotePayload[],
	at: string,
): MarketWatchPayloadV1 {
	const next: MarketWatchPayloadV1 = {
		...prev,
		symbolStats: { ...prev.symbolStats },
		snapshots: [...prev.snapshots],
		persistCount: prev.persistCount,
		lastPersistAt: prev.lastPersistAt,
	};

	const rows = quotes.map(q => ({
		symbol: q.symbol.toLowerCase(),
		close: q.close,
		date: q.date,
	}));

	next.snapshots.push({ at, rows });
	next.snapshots = next.snapshots.slice(-MAX_SNAPSHOTS);

	for (const q of quotes) {
		const sym = q.symbol.toLowerCase();
		const cur = prev.symbolStats[sym];
		const closes = [...(cur?.closes ?? []), q.close].slice(-MAX_CLOSES);
		const prevClose = closes.length >= 2 ? closes[closes.length - 2] : undefined;
		const smaWindow = closes.slice(-Math.min(20, closes.length));
		const sma20 = smaWindow.length >= 2 ? avg(smaWindow) : undefined;
		const deltaPct = prevClose && prevClose !== 0 ? ((q.close - prevClose) / prevClose) * 100 : undefined;
		let trendLabel: MarketSymbolRollStats['trendLabel'] = 'flat';
		if (deltaPct !== undefined) {
			if (deltaPct > 0.35) trendLabel = 'up';
			else if (deltaPct < -0.35) trendLabel = 'down';
			else trendLabel = 'flat';
		}

		next.symbolStats[sym] = {
			closes,
			samples: closes.length,
			lastClose: q.close,
			lastDate: q.date,
			prevClose,
			sma20,
			deltaPct,
			trendLabel,
		};
	}

	return next;
}
