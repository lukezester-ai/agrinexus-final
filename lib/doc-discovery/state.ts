import { getSupabaseServiceClient } from '../infra/supabase-service.js';
import type { SourceHealthEntry, StoredDiscoveryStateV1 } from './types.js';

const ROW_ID = 'singleton';

function parseLastRunSummary(raw: unknown): StoredDiscoveryStateV1['lastRunSummary'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	if (typeof o.at !== 'string') return undefined;
	const ct = o.countsByTopic;
	const cs = o.countsBySource;
	const sec = o.secondaryPagesFetched;
	const bumps = o.keywordWeightBumps;
	if (typeof ct !== 'object' || ct === null) return undefined;
	if (typeof cs !== 'object' || cs === null) return undefined;
	if (typeof sec !== 'number') return undefined;
	if (typeof bumps !== 'number') return undefined;
	return {
		at: o.at,
		countsByTopic: { ...(ct as Record<string, number>) },
		countsBySource: { ...(cs as Record<string, number>) },
		secondaryPagesFetched: sec,
		keywordWeightBumps: bumps,
	};
}

export function defaultDiscoveryState(): StoredDiscoveryStateV1 {
	return {
		version: 1,
		topicExtraKeywords: {},
		topicMinScore: {},
		sourcePriority: {},
		sourceHealth: {},
		topicKeywordWeights: {},
		runLog: [],
	};
}

export async function loadDiscoveryState(): Promise<StoredDiscoveryStateV1> {
	const client = getSupabaseServiceClient();
	if (!client) return defaultDiscoveryState();

	const { data, error } = await client
		.from('doc_discovery_state')
		.select('payload')
		.eq('id', ROW_ID)
		.maybeSingle();

	if (error || !data?.payload || typeof data.payload !== 'object') {
		return defaultDiscoveryState();
	}

	const p = data.payload as Partial<StoredDiscoveryStateV1>;
	if (p.version !== 1 || !p.topicExtraKeywords || typeof p.topicExtraKeywords !== 'object') {
		return defaultDiscoveryState();
	}

	const kw =
		p.topicKeywordWeights && typeof p.topicKeywordWeights === 'object'
			? ({ ...p.topicKeywordWeights } as StoredDiscoveryStateV1['topicKeywordWeights'])
			: {};

	const summary = parseLastRunSummary(p.lastRunSummary);

	return {
		version: 1,
		topicExtraKeywords: { ...p.topicExtraKeywords },
		topicMinScore: p.topicMinScore && typeof p.topicMinScore === 'object' ? { ...p.topicMinScore } : {},
		sourcePriority: p.sourcePriority && typeof p.sourcePriority === 'object' ? { ...p.sourcePriority } : {},
		sourceHealth:
			p.sourceHealth && typeof p.sourceHealth === 'object'
				? ({ ...p.sourceHealth } as Record<string, SourceHealthEntry>)
				: {},
		topicKeywordWeights: kw,
		lastRunSummary: summary,
		runLog: Array.isArray(p.runLog) ? [...p.runLog].slice(-30) : [],
	};
}

export async function saveDiscoveryState(state: StoredDiscoveryStateV1): Promise<{ ok: boolean; error?: string }> {
	const client = getSupabaseServiceClient();
	if (!client) return { ok: false, error: 'Supabase service client not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' };

	const payload: StoredDiscoveryStateV1 = {
		...state,
		runLog: state.runLog.slice(-30),
	};

	const { error } = await client.from('doc_discovery_state').upsert(
		{
			id: ROW_ID,
			payload,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'id' },
	);

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}
