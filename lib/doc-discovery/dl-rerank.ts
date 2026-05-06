import { openAIMessageContentToString, resolveTextChatUpstream } from '../llm-routing.js';
import type { VectorSearchRow } from './vector-db.js';

type DlPick = { id: string; score: number };

function parseJsonLoose(raw: string): unknown | null {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

function parseRerankResponse(raw: string): DlPick[] {
	const t = raw.trim();
	const parsed = parseJsonLoose(t);
	if (!parsed || typeof parsed !== 'object') return [];
	const picks = (parsed as { picks?: unknown }).picks;
	if (!Array.isArray(picks)) return [];
	const out: DlPick[] = [];
	for (const p of picks) {
		if (!p || typeof p !== 'object') continue;
		const id = String((p as { id?: unknown }).id ?? '').trim();
		const scoreRaw = (p as { score?: unknown }).score;
		const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);
		if (!id || !Number.isFinite(score)) continue;
		out.push({ id, score: Math.max(0, Math.min(1, score)) });
	}
	return out;
}

export async function rerankSemanticResultsDl(
	query: string,
	rows: VectorSearchRow[],
): Promise<{ applied: boolean; rows: VectorSearchRow[]; model?: string; error?: string }> {
	if (rows.length <= 1) return { applied: false, rows };
	const up = resolveTextChatUpstream();
	if (!up) return { applied: false, rows, error: 'No text LLM upstream configured' };

	const cands = rows.slice(0, Math.min(14, rows.length)).map((r, i) => ({
		id: String(i + 1),
		title: r.title ?? '',
		url: r.url,
		topic: r.topic_id ?? '',
		similarity: r.similarity,
	}));

	const prompt = [
		'You are a ranking model for legal-agri document search.',
		'Given query and candidates, return JSON only:',
		'{"picks":[{"id":"1","score":0.91}, ...]}',
		'Keep only IDs from input and sort by relevance descending.',
		`Query: ${query}`,
		`Candidates: ${JSON.stringify(cands)}`,
	].join('\n');

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (up.bearer) headers.Authorization = `Bearer ${up.bearer}`;

	try {
		const res = await fetch(up.completionUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: up.model,
				temperature: 0.05,
				max_tokens: 420,
				messages: [
					{ role: 'system', content: 'Return strict JSON only.' },
					{ role: 'user', content: prompt },
				],
				...(up.useJsonObjectFormat ? { response_format: { type: 'json_object' } } : {}),
			}),
		});
		const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[]; error?: { message?: string } };
		if (!res.ok) return { applied: false, rows, model: up.model, error: data.error?.message || 'rerank upstream error' };
		const content = openAIMessageContentToString(data.choices?.[0]?.message?.content);
		const picks = parseRerankResponse(content);
		if (picks.length === 0) return { applied: false, rows, model: up.model, error: 'Invalid rerank JSON' };

		const byId = new Map(cands.map(c => [c.id, c]));
		const order = picks.filter(p => byId.has(p.id)).sort((a, b) => b.score - a.score).map(p => byId.get(p.id)!);
		const used = new Set(order.map(x => x.id));
		const remaining = cands.filter(c => !used.has(c.id));
		const fullOrder = [...order, ...remaining];

		const reranked = fullOrder.map(c => rows[Number(c.id) - 1]!);
		return { applied: true, rows: reranked, model: up.model };
	} catch (e) {
		return { applied: false, rows, model: up.model, error: e instanceof Error ? e.message : String(e) };
	}
}
