import { getSupabaseServiceClient } from './infra/supabase-service.js';
import type { MarketWatchPayloadV1 } from './market-watch-types.js';

const ROW_ID = 'singleton';

export function defaultMarketWatchPayload(): MarketWatchPayloadV1 {
	return {
		version: 1,
		symbolStats: {},
		snapshots: [],
		persistCount: 0,
	};
}

function parsePayload(raw: unknown): MarketWatchPayloadV1 | null {
	if (!raw || typeof raw !== 'object') return null;
	const p = raw as Record<string, unknown>;
	if (p.version !== 1) return null;
	if (!p.symbolStats || typeof p.symbolStats !== 'object') return null;
	if (!Array.isArray(p.snapshots)) return null;
	const persistCount = typeof p.persistCount === 'number' ? p.persistCount : 0;
	let lastInsights: MarketWatchPayloadV1['lastInsights'];
	if (p.lastInsights && typeof p.lastInsights === 'object') {
		const li = p.lastInsights as Record<string, unknown>;
		const at = typeof li.at === 'string' ? li.at : '';
		const summaryBg = typeof li.summaryBg === 'string' ? li.summaryBg : '';
		const predictionsBg = typeof li.predictionsBg === 'string' ? li.predictionsBg : '';
		if (at && summaryBg && predictionsBg) {
			lastInsights = {
				at,
				summaryBg,
				predictionsBg,
				...(typeof li.model === 'string' ? { model: li.model } : {}),
				...(typeof li.error === 'string' ? { error: li.error } : {}),
			};
		}
	}
	return {
		version: 1,
		symbolStats: { ...(p.symbolStats as MarketWatchPayloadV1['symbolStats']) },
		snapshots: [...(p.snapshots as MarketWatchPayloadV1['snapshots'])],
		...(Array.isArray(p.marketModels) ? { marketModels: [...p.marketModels] as MarketWatchPayloadV1['marketModels'] } : {}),
		...(lastInsights ? { lastInsights } : {}),
		persistCount,
		...(typeof p.lastPersistAt === 'string' ? { lastPersistAt: p.lastPersistAt } : {}),
	};
}

export async function loadMarketWatchState(): Promise<MarketWatchPayloadV1> {
	const client = getSupabaseServiceClient();
	if (!client) return defaultMarketWatchPayload();

	const { data, error } = await client.from('market_watch_state').select('payload').eq('id', ROW_ID).maybeSingle();

	if (error || !data?.payload) return defaultMarketWatchPayload();

	const parsed = parsePayload(data.payload);
	return parsed ?? defaultMarketWatchPayload();
}

export async function saveMarketWatchState(state: MarketWatchPayloadV1): Promise<{ ok: boolean; error?: string }> {
	const client = getSupabaseServiceClient();
	if (!client) return { ok: false, error: 'Supabase service client not configured' };

	const { error } = await client.from('market_watch_state').upsert(
		{
			id: ROW_ID,
			payload: state,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'id' },
	);

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}
