import type { DiscoveredDocLink, DiscoveryTopic } from './types.js';

const STOPWORDS = new Set([
	'download',
	'document',
	'file',
	'attach',
	'pdf',
	'doc',
	'docx',
	'application',
	'octet',
	'stream',
	'https',
	'http',
	'www',
	'gov',
	'government',
	'ministerstvo',
	'aktual',
	'final',
	'version',
]);

export function tokenizeForLearning(titleLower: string): string[] {
	const raw = titleLower.replace(/\.[a-z0-9]{2,5}$/i, '');
	const parts = raw.split(/[^a-zа-яёії0-9]+/i).filter(Boolean);
	const out: string[] = [];
	for (const p of parts) {
		const w = p.toLowerCase();
		if (w.length < 5) continue;
		if (STOPWORDS.has(w)) continue;
		if (/^\d+$/.test(w)) continue;
		out.push(w);
	}
	return out;
}

/** От високо оценени находки добавя токени към темата (просто „самообучение“ без ML) */
export function learnKeywordsFromDiscoveries(
	discovered: DiscoveredDocLink[],
	topics: DiscoveryTopic[],
	prevExtra: Record<string, string[]>,
	maxPerTopic: number,
): Record<string, string[]> {
	const byTopic = new Map<string, Set<string>>();
	for (const t of topics) {
		byTopic.set(t.id, new Set((prevExtra[t.id] ?? []).map(s => s.toLowerCase())));
	}

	const freq = new Map<string, Map<string, number>>();
	for (const d of discovered) {
		if (d.score < 5) continue;
		const tokens = tokenizeForLearning(d.title.toLowerCase());
		let m = freq.get(d.topicId);
		if (!m) {
			m = new Map();
			freq.set(d.topicId, m);
		}
		for (const tok of tokens) {
			m.set(tok, (m.get(tok) ?? 0) + 1);
		}
	}

	for (const [topicId, counts] of freq) {
		const set = byTopic.get(topicId);
		if (!set) continue;
		const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
		for (const [tok] of ranked) {
			if (set.size >= maxPerTopic) break;
			let already = false;
			const topic = topics.find(x => x.id === topicId);
			if (topic?.seedKeywords.some(k => k.toLowerCase() === tok)) already = true;
			if (!already) set.add(tok);
		}
	}

	const result: Record<string, string[]> = {};
	for (const [id, set] of byTopic) {
		result[id] = [...set];
	}
	return result;
}

function kwLenPts(kw: string): number {
	if (kw.length >= 8) return 4;
	if (kw.length >= 5) return 3;
	return 2;
}

/**
 * Скор с претегляне на научени думи + малък бонус при множество съвпадения.
 * Seed ключовете са водещи; extra се умножава по тегло (учено).
 */
export function scoreLinkDetailed(
	textLower: string,
	topic: DiscoveryTopic,
	extra: string[],
	weights: Record<string, number> | undefined,
): { score: number; matchedSeedCount: number; matchedExtras: string[] } {
	const wmap = weights ?? {};
	let score = 0;
	let matchedSeedCount = 0;
	const matchedExtras: string[] = [];

	for (const kw of topic.seedKeywords) {
		const k = kw.toLowerCase();
		if (k.length < 3) continue;
		if (textLower.includes(k)) {
			matchedSeedCount += 1;
			score += kwLenPts(k);
		}
	}

	for (const kw of extra) {
		const k = kw.toLowerCase();
		if (k.length < 3) continue;
		if (textLower.includes(k)) {
			matchedExtras.push(k);
			const wt = Math.min(8, Math.max(0.25, wmap[k] ?? 1));
			score += kwLenPts(k) * wt * 0.82;
		}
	}

	if (matchedSeedCount >= 2) score += 2;
	if (matchedExtras.length >= 3) score += 3;
	else if (matchedExtras.length >= 2) score += 1;

	return { score: Math.round(score * 10) / 10, matchedSeedCount, matchedExtras };
}

/** @deprecated за нов код — ползвай scoreLinkDetailed */
export function scoreLinkForTopic(textLower: string, topic: DiscoveryTopic, extra: string[]): number {
	return scoreLinkDetailed(textLower, topic, extra, undefined).score;
}

function pruneWeightRow(row: Record<string, number>, maxKeys: number, floorCut: number): Record<string, number> {
	const sorted = Object.entries(row)
		.filter(([, v]) => v >= floorCut)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	return Object.fromEntries(sorted.slice(0, maxKeys));
}

/** Леко „забравяне“ на неползвани тежести между нощните пускания */
export function decayKeywordWeights(
	prev: Record<string, Record<string, number>> | undefined,
	topicIds: string[],
	factor: number,
	floor: number,
): Record<string, Record<string, number>> {
	const next: Record<string, Record<string, number>> = {};
	for (const tid of topicIds) {
		const row = prev?.[tid];
		if (!row || typeof row !== 'object') {
			next[tid] = {};
			continue;
		}
		const o: Record<string, number> = {};
		for (const [k, v] of Object.entries(row)) {
			if (typeof v !== 'number' || !Number.isFinite(v)) continue;
			const nv = Math.max(floor, v * factor);
			o[k.toLowerCase()] = Math.round(nv * 1000) / 1000;
		}
		next[tid] = o;
	}
	return next;
}

export function bumpKeywordWeightsFromDiscoveries(
	discovered: DiscoveredDocLink[],
	prev: Record<string, Record<string, number>>,
	bump: number,
	maxKeysPerTopic: number,
	weightFloorPrune: number,
): { next: Record<string, Record<string, number>>; bumpsApplied: number } {
	const next: Record<string, Record<string, number>> = { ...prev };
	let bumpsApplied = 0;

	for (const d of discovered) {
		if (d.score < 5) continue;
		const keys = d.matchedExtras ?? [];
		if (keys.length === 0) continue;

		const row = { ...(next[d.topicId] ?? {}) };
		for (const k of keys) {
			const kk = k.toLowerCase();
			row[kk] = (row[kk] ?? 1) + bump;
			bumpsApplied += 1;
		}
		next[d.topicId] = pruneWeightRow(row, maxKeysPerTopic, weightFloorPrune);
	}

	return { next, bumpsApplied };
}

/** Нови думи от learning получават начално тегло 1 */
/** По-силно начално тегло за ключови думи, предложени от LLM (следващият обход ги „утвърждава“ при удар). */
export function boostKeywordWeightsForTopicKeys(
	weights: Record<string, Record<string, number>>,
	byTopic: Record<string, string[]>,
	boost: number,
	maxKeysPerTopic: number,
	weightFloorPrune: number,
): Record<string, Record<string, number>> {
	const next: Record<string, Record<string, number>> = { ...weights };
	for (const [tid, keys] of Object.entries(byTopic)) {
		if (!keys?.length) continue;
		const row = { ...(next[tid] ?? {}) };
		for (const k of keys) {
			const kk = k.toLowerCase();
			row[kk] = Math.max(row[kk] ?? 1, boost);
		}
		next[tid] = pruneWeightRow(row, maxKeysPerTopic, weightFloorPrune);
	}
	return next;
}

export function ensureWeightsForExtraKeywords(
	extraByTopic: Record<string, string[]>,
	weights: Record<string, Record<string, number>>,
	maxKeysPerTopic: number,
	weightFloorPrune: number,
): Record<string, Record<string, number>> {
	const next: Record<string, Record<string, number>> = { ...weights };
	for (const [tid, words] of Object.entries(extraByTopic)) {
		const row = { ...(next[tid] ?? {}) };
		for (const w of words) {
			const kk = w.toLowerCase();
			if (row[kk] === undefined) row[kk] = 1;
		}
		next[tid] = pruneWeightRow(row, maxKeysPerTopic, weightFloorPrune);
	}
	return next;
}

export function topWeightedKeywordsPreview(
	weights: Record<string, Record<string, number>>,
	topicIds: string[],
	limitPerTopic: number,
): Record<string, Array<{ keyword: string; weight: number }>> {
	const out: Record<string, Array<{ keyword: string; weight: number }>> = {};
	for (const tid of topicIds) {
		const row = weights[tid];
		if (!row) {
			out[tid] = [];
			continue;
		}
		out[tid] = Object.entries(row)
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, limitPerTopic)
			.map(([keyword, weight]) => ({ keyword, weight: Math.round(weight * 100) / 100 }));
	}
	return out;
}

export function tuneTopicMinScore(
	topics: DiscoveryTopic[],
	discovered: DiscoveredDocLink[],
	prev: Record<string, number>,
): Record<string, number> {
	const next: Record<string, number> = {};
	for (const t of topics) {
		const base = Number.isFinite(prev[t.id]) ? prev[t.id] : 4;
		const hits = discovered.filter(d => d.topicId === t.id);
		if (hits.length === 0) {
			next[t.id] = Math.max(3, base - 1);
			continue;
		}
		const avg = hits.reduce((s, x) => s + x.score, 0) / hits.length;
		if (avg >= 8 && hits.length >= 3) next[t.id] = Math.min(9, base + 1);
		else if (avg < 5) next[t.id] = Math.max(3, base - 1);
		else next[t.id] = base;
	}
	return next;
}

export function tuneSourcePriority(
	sourceIds: string[],
	discovered: DiscoveredDocLink[],
	prev: Record<string, number>,
): Record<string, number> {
	const next: Record<string, number> = {};
	for (const id of sourceIds) {
		const base = Number.isFinite(prev[id]) ? prev[id] : 1;
		const count = discovered.filter(d => d.sourceId === id).length;
		if (count >= 8) next[id] = Math.min(5, base + 1);
		else if (count === 0) next[id] = Math.max(1, base - 1);
		else next[id] = base;
	}
	return next;
}
