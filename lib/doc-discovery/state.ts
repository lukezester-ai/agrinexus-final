import { getSupabaseServiceClient } from '../infra/supabase-service.js';
import type {
	DiscoveryInsightsV1,
	DiscoveryStatisticsV1,
	SourceHealthEntry,
	StoredDiscoveryStateV1,
	StoredDynamicSource,
} from './types.js';

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

function parseDynamicSources(raw: unknown): StoredDynamicSource[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const out: StoredDynamicSource[] = [];
	for (const x of raw) {
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, unknown>;
		const id = typeof o.id === 'string' ? o.id.trim() : '';
		const labelBg = typeof o.labelBg === 'string' ? o.labelBg.trim() : '';
		const indexUrl = typeof o.indexUrl === 'string' ? o.indexUrl.trim() : '';
		const addedAt = typeof o.addedAt === 'string' ? o.addedAt.trim() : '';
		if (!id || !labelBg || !indexUrl || !addedAt) continue;
		let suggestedTopics: string[] | undefined;
		if (Array.isArray(o.suggestedTopics)) {
			suggestedTopics = o.suggestedTopics.filter((t): t is string => typeof t === 'string');
			if (suggestedTopics.length === 0) suggestedTopics = undefined;
		}
		const provenance = o.provenance === 'llm' ? 'llm' : undefined;
		out.push({ id, labelBg, indexUrl, addedAt, ...(suggestedTopics ? { suggestedTopics } : {}), ...(provenance ? { provenance } : {}) });
	}
	return out.length ? out : undefined;
}

function parseDiscoveryStatistics(raw: unknown): DiscoveryStatisticsV1 | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const s = raw as Record<string, unknown>;
	if (s.version !== 1) return undefined;
	if (typeof s.runCount !== 'number' || typeof s.cumulativeDiscoveries !== 'number') return undefined;
	if (!Array.isArray(s.recentRuns)) return undefined;
	const topicTotals =
		s.topicTotals && typeof s.topicTotals === 'object'
			? { ...(s.topicTotals as Record<string, { discoveries: number; runsWithHits: number }>) }
			: {};
	const sourceTotals =
		s.sourceTotals && typeof s.sourceTotals === 'object'
			? {
					...(s.sourceTotals as Record<
						string,
						{ discoveries: number; attempts: number; failures: number; cooldownSkips: number }
					>),
				}
			: {};
	return {
		version: 1,
		runCount: s.runCount,
		cumulativeDiscoveries: s.cumulativeDiscoveries,
		recentRuns: [...s.recentRuns] as DiscoveryStatisticsV1['recentRuns'],
		topicTotals,
		sourceTotals,
	};
}

function parseDiscoveryInsights(raw: unknown): DiscoveryInsightsV1 | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	if (typeof o.at !== 'string') return undefined;
	const summaryBg = typeof o.summaryBg === 'string' ? o.summaryBg : '';
	const predictionsBg = typeof o.predictionsBg === 'string' ? o.predictionsBg : '';
	if (!summaryBg.trim() && !predictionsBg.trim()) return undefined;
	return {
		at: o.at,
		summaryBg: summaryBg.trim(),
		predictionsBg: predictionsBg.trim(),
		...(typeof o.model === 'string' ? { model: o.model } : {}),
		...(typeof o.error === 'string' ? { error: o.error } : {}),
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
	const dynamicSources = parseDynamicSources(p.dynamicSources);
	const discoveryStatistics = parseDiscoveryStatistics(p.discoveryStatistics);
	const discoveryInsights = parseDiscoveryInsights(p.discoveryInsights);

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
		...(dynamicSources ? { dynamicSources } : {}),
		...(discoveryStatistics ? { discoveryStatistics } : {}),
		...(discoveryInsights ? { discoveryInsights } : {}),
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
