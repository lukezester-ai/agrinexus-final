/**
 * Търсене в демо marketplace — токенизация, задължително съвпадение на всички токени,
 * скор за подреждане по релевантност (фраза, по-дълги думи, позиция).
 */

export function normalizeMarketSearchQuery(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Разбива заявката на значими токени (пропуска типични стоп-думи за кратки заявки). */
export function tokenizeMarketSearchQuery(normalized: string): string[] {
	if (!normalized) return [];
	const STOP = new Set([
		'и',
		'на',
		'в',
		'за',
		'от',
		'the',
		'a',
		'an',
		'and',
		'or',
		'to',
		'of',
		'in',
	]);
	const parts = normalized.split(/[\s,/|+]+/).filter(Boolean);
	const out: string[] = [];
	for (const p of parts) {
		const t = p.replace(/^\.+|\.+$/g, '');
		if (t.length < 2) continue;
		if (t.length <= 3 && STOP.has(t)) continue;
		out.push(t);
	}
	return out;
}

/** Връща 0 ако няма съвпадение по правилата; иначе положителен скор. */
export function scoreDealSearchMatch(haystackLower: string, queryRaw: string): number {
	const q = normalizeMarketSearchQuery(queryRaw);
	if (!q) return 1;

	const tokens = tokenizeMarketSearchQuery(q);
	if (tokens.length === 0) {
		if (!q || q.length < 2) return 0;
		return haystackLower.includes(q) ? 10 + q.length : 0;
	}

	let score = 0;
	for (const token of tokens) {
		let idx = haystackLower.indexOf(token);
		if (idx === -1 && token.length >= 4) {
			// Толеранс към малки разлики в края (напр. „пшениц“ без „а“)
			idx = haystackLower.indexOf(token.slice(0, Math.max(3, token.length - 1)));
		}
		if (idx === -1) return 0;
		score += 6 + Math.min(token.length, 12);
		if (idx < 40) score += 4;
	}

	if (haystackLower.includes(q)) score += 18;

	return score;
}

export function dealMatchesMarketQuery(haystackLower: string, queryRaw: string): boolean {
	return scoreDealSearchMatch(haystackLower, queryRaw) > 0;
}
