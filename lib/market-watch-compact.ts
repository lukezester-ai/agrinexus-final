import { instrumentHumanLabels } from './market-instruments.js';
import type { MarketWatchPayloadV1 } from './market-watch-types.js';

/** Компактен вход към LLM — същата семантика като в market-watch-insights-llm. */
export function compactMarketWatchForPrompt(payload: MarketWatchPayloadV1): unknown {
	const labels = instrumentHumanLabels();
	const stats = Object.entries(payload.symbolStats).map(([sym, v]) => ({
		symbol: sym,
		label: labels[sym]?.bg ?? sym,
		lastClose: v.lastClose,
		lastDate: v.lastDate,
		trend: v.trendLabel,
		deltaPctLast: v.deltaPct,
		sma20: v.sma20,
		samples: v.samples,
	}));
	const recentSnap = payload.snapshots.slice(-4).map(s => ({
		at: s.at,
		count: s.rows.length,
	}));
	return {
		stats,
		recentSnapshotsMeta: recentSnap,
		previousModels: payload.marketModels ?? [],
	};
}
