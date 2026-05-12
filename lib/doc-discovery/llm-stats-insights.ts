import { chatProviderLabel, openAIMessageContentToString, resolveTextChatUpstream } from '../llm-routing.js';
import { compactStatisticsForLlm } from './discovery-statistics.js';
import type { DiscoveredDocLink, DiscoveryStatisticsV1, DiscoveryTopic } from './types.js';

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

/**
 * LLM обобщава статистиката и прави предположения (ясно маркирани като не-сигурни).
 */
export async function generateDiscoveryInsightsWithLlm(opts: {
	statistics: DiscoveryStatisticsV1 | undefined;
	topics: DiscoveryTopic[];
	discoveredSample: DiscoveredDocLink[];
	runAtISO: string;
}): Promise<{ summaryBg: string; predictionsBg: string; model: string; error?: string }> {
	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		return { summaryBg: '', predictionsBg: '', model: '', error: 'LLM не е конфигуриран.' };
	}

	const userPayload = JSON.stringify({
		runAt: opts.runAtISO,
		topicLabels: Object.fromEntries(opts.topics.map(t => [t.id, t.labelBg])),
		stats: compactStatisticsForLlm(opts.statistics),
		topDiscoveriesThisRun: opts.discoveredSample.slice(0, 12).map(d => ({
			topicId: d.topicId,
			score: d.score,
			title: d.title.slice(0, 140),
			sourceId: d.sourceId,
		})),
	});

	const system = `Ти си аналитик за автоматизиран обход на публични агро-документи (България/EU).
На база само подадените числа и метаданни напиши на български:
1) summaryBg — 3–6 изречения фактологично какво показват метриките (без да измисляш липсващи данни).
2) predictionsBg — 2–5 изречения с предположения за следващите обходи (кои теми/източници може да са слаби или силни), изрично с думите че това е предположение, не факт.

Отговорът е САМО JSON: {"summaryBg":"...","predictionsBg":"..."}`;

	const temperature = Math.min(1, Math.max(0, Number(process.env.DOC_DISCOVERY_LLM_INSIGHTS_TEMPERATURE ?? '0.35') || 0.35));
	const maxTokens = Math.min(1800, Math.max(350, Number(process.env.DOC_DISCOVERY_LLM_INSIGHTS_MAX_TOKENS ?? '900') || 900));

	const buildBody = (jsonFormat: boolean): Record<string, unknown> => ({
		model: upstream.model,
		temperature,
		max_tokens: maxTokens,
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: userPayload },
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
		let retry: boolean;
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
			summaryBg: '',
			predictionsBg: '',
			model: upstream.model,
			error: `${chatProviderLabel(upstream.provider)} HTTP ${res.status}: ${detail}`,
		};
	}

	let data: { choices?: { message?: { content?: unknown } }[] };
	try {
		data = JSON.parse(raw) as typeof data;
	} catch {
		return { summaryBg: '', predictionsBg: '', model: upstream.model, error: 'Невалиден JSON от LLM.' };
	}

	const content = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!content) {
		return { summaryBg: '', predictionsBg: '', model: upstream.model, error: 'Празен отговор от LLM.' };
	}

	const parsed = tryParseJson(stripJsonFence(content));
	if (!parsed || typeof parsed !== 'object') {
		return { summaryBg: '', predictionsBg: '', model: upstream.model, error: 'Неуспешен parse на insights JSON.' };
	}
	const o = parsed as Record<string, unknown>;
	const summaryBg = typeof o.summaryBg === 'string' ? o.summaryBg.trim().slice(0, 4000) : '';
	const predictionsBg = typeof o.predictionsBg === 'string' ? o.predictionsBg.trim().slice(0, 4000) : '';

	return {
		summaryBg,
		predictionsBg,
		model: upstream.model,
		...(summaryBg || predictionsBg ? {} : { error: 'Празни полета summaryBg/predictionsBg.' }),
	};
}
