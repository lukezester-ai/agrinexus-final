import { chatProviderLabel, openAIMessageContentToString, resolveTextChatUpstream } from '../llm-routing.js';
import type { DiscoveredDocLink, DiscoveryTopic } from './types.js';

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

function sanitizeToken(raw: string): string | null {
	const t = raw
		.trim()
		.toLowerCase()
		.replace(/^["'«»]+|["'«»]+$/g, '');
	if (t.length < 5 || t.length > 44) return null;
	if (!/[a-zа-яёії]/i.test(t)) return null;
	if (/[^a-zа-яёії0-9-]/i.test(t)) return null;
	return t;
}

function seedAndExtraContains(topic: DiscoveryTopic, extra: string[], token: string): boolean {
	const k = token.toLowerCase();
	for (const s of topic.seedKeywords) {
		if (s.toLowerCase().includes(k) || k.includes(s.toLowerCase())) return true;
	}
	for (const e of extra) {
		if (e.toLowerCase() === k) return true;
	}
	return false;
}

type LlmKeywordsPayload = {
	keywords?: Record<string, unknown>;
};

/**
 * Пита конфигурирания текстов LLM за допълнителни ключови думи по теми (самообучение „отгоре“ върху евристиката).
 */
export async function augmentLearnedKeywordsWithLlm(opts: {
	topics: DiscoveryTopic[];
	discovered: DiscoveredDocLink[];
	currentExtraByTopic: Record<string, string[]>;
	maxAddPerTopic: number;
}): Promise<{
	merged: Record<string, string[]>;
	addedByTopic: Record<string, string[]>;
	model: string;
	error?: string;
}> {
	const upstream = resolveTextChatUpstream();
	const merged: Record<string, string[]> = {};
	const addedByTopic: Record<string, string[]> = {};
	const topicIds = new Set(opts.topics.map(t => t.id));

	for (const t of opts.topics) {
		merged[t.id] = [...(opts.currentExtraByTopic[t.id] ?? []).map(s => s.toLowerCase())];
		addedByTopic[t.id] = [];
	}

	if (!upstream) {
		return { merged, addedByTopic, model: '', error: 'LLM не е конфигуриран (MISTRAL_API_KEY / OLLAMA / OPENAI).' };
	}

	const samplesByTopic = new Map<string, Array<{ title: string; url: string; score: number }>>();
	for (const t of opts.topics) samplesByTopic.set(t.id, []);
	const byScore = [...opts.discovered].sort((a, b) => b.score - a.score);
	for (const d of byScore) {
		const arr = samplesByTopic.get(d.topicId);
		if (arr && arr.length < 7) {
			arr.push({ title: d.title.slice(0, 220), url: d.url.slice(0, 280), score: d.score });
		}
	}

	const briefTopics = opts.topics.map(t => ({
		id: t.id,
		labelBg: t.labelBg,
		seedKeywords: t.seedKeywords,
		alreadyLearned: (merged[t.id] ?? []).slice(0, 40),
		samples: samplesByTopic.get(t.id) ?? [],
	}));

	const userJson = JSON.stringify({
		topics: briefTopics,
		hint: 'Добави само нови единични ключови думи (корени), които липсват в seed/alreadyLearned и са подходящи за филтриране на заглавия на официални документи (BG/EU).',
	});

	const system = `You are improving a Bulgarian/EU agricultural document crawler keyword list.
Return ONLY one JSON object, no markdown, shape strictly:
{"keywords":{"topic_id":["token",...], ...}}
Rules:
- Use lowercase tokens; Bulgarian or Latin roots ok; length typically 5-22 chars.
- Do NOT repeat seedKeywords or alreadyLearned lists from input.
- 0-${opts.maxAddPerTopic} new keywords per topic id (${[...topicIds].join(', ')}) — fewer is ok if unsure.
- If no useful additions for a topic, use empty array.
- Never include urls, emails, or full sentences.`;

	const temperature = Math.min(1, Math.max(0, Number(process.env.DOC_DISCOVERY_LLM_TEMPERATURE ?? '0.25') || 0.25));
	const maxTokens = Math.min(1800, Math.max(400, Number(process.env.DOC_DISCOVERY_LLM_MAX_TOKENS ?? '900') || 900));

	const buildBody = (jsonFormat: boolean): Record<string, unknown> => ({
		model: upstream.model,
		temperature,
		max_tokens: maxTokens,
		messages: [
			{ role: 'system', content: system },
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
			merged,
			addedByTopic,
			model: upstream.model,
			error: `${chatProviderLabel(upstream.provider)} HTTP ${res.status}: ${detail}`,
		};
	}

	let data: { choices?: { message?: { content?: unknown } }[] };
	try {
		data = JSON.parse(raw) as typeof data;
	} catch {
		return { merged, addedByTopic, model: upstream.model, error: 'Невалиден JSON от LLM.' };
	}

	const content = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!content) {
		return { merged, addedByTopic, model: upstream.model, error: 'Празен отговор от LLM.' };
	}

	const parsed = tryParseJson(stripJsonFence(content));
	const kwRoot =
		parsed && typeof parsed === 'object' && parsed !== null
			? (parsed as LlmKeywordsPayload).keywords
			: null;

	if (!kwRoot || typeof kwRoot !== 'object') {
		return {
			merged,
			addedByTopic,
			model: upstream.model,
			error: 'LLM не върна ключ keywords в JSON.',
		};
	}

	for (const t of opts.topics) {
		const rawList = kwRoot[t.id];
		if (!Array.isArray(rawList)) continue;
		const set = new Set(merged[t.id]);
		for (const item of rawList) {
			if (typeof item !== 'string') continue;
			const tok = sanitizeToken(item);
			if (!tok) continue;
			if (seedAndExtraContains(t, [...set], tok)) continue;
			if (set.has(tok)) continue;
			if ((addedByTopic[t.id]?.length ?? 0) >= opts.maxAddPerTopic) break;
			set.add(tok);
			addedByTopic[t.id]!.push(tok);
		}
		merged[t.id] = [...set];
	}

	return {
		merged,
		addedByTopic,
		model: upstream.model,
	};
}
