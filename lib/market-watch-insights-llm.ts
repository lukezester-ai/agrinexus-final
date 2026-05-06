import { chatProviderLabel, openAIMessageContentToString, resolveTextChatUpstream } from './llm-routing.js';
import { compactMarketWatchForPrompt } from './market-watch-compact.js';
import {
	MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT,
	MARKET_WATCH_INSIGHTS_USER_NOTE,
} from './market-watch-insights-prompt.js';
import type { MarketWatchPayloadV1 } from './market-watch-types.js';

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

export async function generateMarketWatchInsightsWithLlm(
	payload: MarketWatchPayloadV1,
): Promise<{
	summaryBg: string;
	predictionsBg: string;
	marketModels: Array<{ id: string; labelBg: string; symbols: string[]; thesisBg?: string }>;
	model: string;
	error?: string;
}> {
	const upstream = resolveTextChatUpstream('market_insights');

	if (!upstream) {
		return { summaryBg: '', predictionsBg: '', marketModels: [], model: '', error: 'LLM не е конфигуриран.' };
	}

	const userJson = JSON.stringify({
		note: MARKET_WATCH_INSIGHTS_USER_NOTE,
		data: compactMarketWatchForPrompt(payload),
	});

	const temperature = Math.min(1, Math.max(0, Number(process.env.MARKET_WATCH_LLM_TEMPERATURE ?? '0.28') || 0.28));
	const maxTokens = Math.min(2000, Math.max(400, Number(process.env.MARKET_WATCH_LLM_MAX_TOKENS ?? '950') || 950));

	const buildBody = (jsonFormat: boolean): Record<string, unknown> => ({
		model: upstream.model,
		temperature,
		max_tokens: maxTokens,
		messages: [
			{ role: 'system', content: MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT },
			{ role: 'user', content: userJson },
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
			summaryBg: '',
			predictionsBg: '',
			marketModels: [],
			model: upstream.model,
			error: `${chatProviderLabel(upstream.provider)} HTTP ${res.status}: ${detail}`,
		};
	}

	let data: { choices?: { message?: { content?: unknown } }[] };
	try {
		data = JSON.parse(raw) as typeof data;
	} catch {
		return { summaryBg: '', predictionsBg: '', marketModels: [], model: upstream.model, error: 'Невалиден JSON от LLM.' };
	}

	const content = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!content) {
		return { summaryBg: '', predictionsBg: '', marketModels: [], model: upstream.model, error: 'Празен отговор от LLM.' };
	}

	const parsed = tryParseJson(stripJsonFence(content));
	if (!parsed || typeof parsed !== 'object') {
		return { summaryBg: '', predictionsBg: '', marketModels: [], model: upstream.model, error: 'Невалиден insights JSON.' };
	}

	const o = parsed as Record<string, unknown>;
	const summaryBg = typeof o.summaryBg === 'string' ? o.summaryBg.trim().slice(0, 4500) : '';
	const predictionsBg = typeof o.predictionsBg === 'string' ? o.predictionsBg.trim().slice(0, 4500) : '';

	const allowed = new Set(Object.keys(payload.symbolStats));
	const marketModels: Array<{ id: string; labelBg: string; symbols: string[]; thesisBg?: string }> = [];
	const symbolsAssigned = new Set<string>();

	if (Array.isArray(o.marketModels)) {
		for (const item of o.marketModels) {
			if (!item || typeof item !== 'object') continue;
			const m = item as Record<string, unknown>;
			const id = typeof m.id === 'string' ? m.id.trim().slice(0, 48) : '';
			const labelBg = typeof m.labelBg === 'string' ? m.labelBg.trim().slice(0, 160) : '';
			const syms = Array.isArray(m.symbols)
				? m.symbols.filter((x): x is string => typeof x === 'string').map(s => s.toLowerCase())
				: [];
			const filtered = syms.filter(s => allowed.has(s) && !symbolsAssigned.has(s));
			const thesisBg = typeof m.thesisBg === 'string' ? m.thesisBg.trim().slice(0, 400) : undefined;
			if (!id || !labelBg || filtered.length === 0) continue;
			for (const s of filtered) symbolsAssigned.add(s);
			marketModels.push({ id, labelBg, symbols: filtered, ...(thesisBg ? { thesisBg } : {}) });
			if (marketModels.length >= 8) break;
		}
	}

	return {
		summaryBg,
		predictionsBg,
		marketModels,
		model: upstream.model,
		...(summaryBg || predictionsBg || marketModels.length ? {} : { error: 'Празен LLM извод.' }),
	};
}
