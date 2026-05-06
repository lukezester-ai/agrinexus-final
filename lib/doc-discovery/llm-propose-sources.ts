import { chatProviderLabel, openAIMessageContentToString, resolveTextChatUpstream } from '../llm-routing.js';
import { compactStatisticsForLlm } from './discovery-statistics.js';
import { discoverySeedUrlId, normalizeDiscoverySeedUrl } from './discovery-url-guard.js';
import type {
	DiscoveredDocLink,
	DiscoveryStatisticsV1,
	DiscoveryTopic,
	StoredDynamicSource,
} from './types.js';

function stripJsonFence(raw: string): string {
	const t = raw.trim();
	const open = t.indexOf('```');
	if (open === -1) return t;
	const after = t.slice(open + 3);
	const nl = after.indexOf('\n');
	const body = nl === -1 ? after : after.slice(nl + 1);
	const close = body.lastIndexOf('```');
	return (close === -1 ? body : body.slice(0, close)).trim();
}

function tryParseJson(text: string): unknown | null {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

export function mergeAndCapDynamicSources(
	existing: StoredDynamicSource[],
	incoming: StoredDynamicSource[],
	maxTotal: number,
): StoredDynamicSource[] {
	const seen = new Set<string>();
	const norm = (u: string) => normalizeDiscoverySeedUrl(u) ?? '';
	const merged: StoredDynamicSource[] = [];
	for (const e of existing) {
		const k = norm(e.indexUrl);
		if (!k || seen.has(k)) continue;
		seen.add(k);
		merged.push({ ...e, indexUrl: k });
	}
	for (const n of incoming) {
		const k = norm(n.indexUrl);
		if (!k || seen.has(k)) continue;
		seen.add(k);
		merged.push({ ...n, indexUrl: k });
	}
	merged.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
	return merged.slice(0, Math.max(0, maxTotal));
}

type RawProposal = { indexUrl?: unknown; labelBg?: unknown; topicHints?: unknown };

/**
 * LLM предлага нови официални начални страници (HTTPS) за следващите обходи.
 */
export async function proposeDiscoverySourcesWithLlm(opts: {
	topics: DiscoveryTopic[];
	existingStaticUrls: string[];
	existingDynamic: StoredDynamicSource[];
	discovered: DiscoveredDocLink[];
	statistics: DiscoveryStatisticsV1 | undefined;
	maxNewThisRun: number;
	runAtISO: string;
}): Promise<{
	added: StoredDynamicSource[];
	addedCount: number;
	model: string;
	error?: string;
}> {
	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		return { added: [], addedCount: 0, model: '', error: 'LLM не е конфигуриран.' };
	}

	const blockedNorm = new Set<string>();
	for (const u of opts.existingStaticUrls) {
		const n = normalizeDiscoverySeedUrl(u);
		if (n) blockedNorm.add(n);
	}
	for (const d of opts.existingDynamic) {
		const n = normalizeDiscoverySeedUrl(d.indexUrl);
		if (n) blockedNorm.add(n);
	}

	const samples = [...opts.discovered]
		.sort((a, b) => b.score - a.score)
		.slice(0, 18)
		.map(d => ({ topicId: d.topicId, title: d.title.slice(0, 160), url: d.url.slice(0, 220), score: d.score }));

	const payload = JSON.stringify({
		topics: opts.topics.map(t => ({ id: t.id, labelBg: t.labelBg })),
		statsDigest: compactStatisticsForLlm(opts.statistics),
		recentSamples: samples,
		rule: `Suggest up to ${opts.maxNewThisRun} NEW official index pages (https only, Bulgarian/EU agriculture: subsidies, plant health, organic, export certs, laws). No login-only portals. Must not duplicate existing URLs.`,
	});

	const system = `You help expand a supervised crawler for Bulgarian/EU farmer documents.
Return ONLY valid JSON (no markdown): {"sources":[{"indexUrl":"https://...","labelBg":"кратко BG име","topicHints":["subsidies"]}]}
topicHints optional — ids from input topics only. Fewer entries is fine if unsure.`;

	const temperature = Math.min(1, Math.max(0, Number(process.env.DOC_DISCOVERY_LLM_SOURCES_TEMPERATURE ?? '0.2') || 0.2));
	const maxTokens = Math.min(1600, Math.max(400, Number(process.env.DOC_DISCOVERY_LLM_SOURCES_MAX_TOKENS ?? '700') || 700));

	const buildBody = (jsonFormat: boolean): Record<string, unknown> => ({
		model: upstream.model,
		temperature,
		max_tokens: maxTokens,
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: payload },
		],
		...(jsonFormat && upstream.useJsonObjectFormat ? { response_format: { type: 'json_object' } } : {}),
	});

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (upstream.bearer) headers.Authorization = `Bearer ${upstream.bearer}`;

	let res = await fetch(upstream.completionUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify(buildBody(true)),
	});

	let raw = await res.text();

	if (!res.ok && upstream.provider === 'mistral' && upstream.useJsonObjectFormat && raw.trim()) {
		let retry = false;
		try {
			const errJson = JSON.parse(raw) as { error?: { message?: string } };
			const msg = String(errJson?.error?.message ?? raw).toLowerCase();
			retry = msg.includes('response_format') || msg.includes('json_object');
		} catch {
			retry = /response_format|json_object/i.test(raw);
		}
		if (retry) {
			res = await fetch(upstream.completionUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(buildBody(false)),
			});
			raw = await res.text();
		}
	}

	if (!res.ok) {
		let detail = raw.slice(0, 400);
		try {
			const j = JSON.parse(raw) as { error?: { message?: string } };
			detail = j?.error?.message ?? detail;
		} catch {
			/* ignore */
		}
		return {
			added: [],
			addedCount: 0,
			model: upstream.model,
			error: `${chatProviderLabel(upstream.provider)} HTTP ${res.status}: ${detail}`,
		};
	}

	let data: { choices?: { message?: { content?: unknown } }[] };
	try {
		data = JSON.parse(raw) as typeof data;
	} catch {
		return { added: [], addedCount: 0, model: upstream.model, error: 'Невалиден JSON от LLM.' };
	}

	const content = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!content) {
		return { added: [], addedCount: 0, model: upstream.model, error: 'Празен отговор от LLM.' };
	}

	const parsed = tryParseJson(stripJsonFence(content));
	const root = parsed && typeof parsed === 'object' && parsed !== null ? (parsed as { sources?: unknown }).sources : null;
	if (!Array.isArray(root)) {
		return { added: [], addedCount: 0, model: upstream.model, error: 'Липсва масив sources в JSON.' };
	}

	const topicIds = new Set(opts.topics.map(t => t.id));
	const added: StoredDynamicSource[] = [];

	for (const item of root as RawProposal[]) {
		if (added.length >= opts.maxNewThisRun) break;
		if (!item || typeof item !== 'object') continue;
		const urlRaw = typeof item.indexUrl === 'string' ? item.indexUrl : '';
		const labelBg = typeof item.labelBg === 'string' ? item.labelBg.trim().slice(0, 120) : '';
		const norm = normalizeDiscoverySeedUrl(urlRaw);
		if (!norm || blockedNorm.has(norm)) continue;
		if (!labelBg || labelBg.length < 4) continue;

		let hints: string[] | undefined;
		if (Array.isArray(item.topicHints)) {
			hints = item.topicHints.filter((x): x is string => typeof x === 'string' && topicIds.has(x));
			if (hints.length === 0) hints = undefined;
		}

		const id = discoverySeedUrlId(norm);
		blockedNorm.add(norm);
		added.push({
			id,
			labelBg,
			indexUrl: norm,
			suggestedTopics: hints,
			addedAt: opts.runAtISO,
			provenance: 'llm',
		});
	}

	return { added, addedCount: added.length, model: upstream.model };
}
