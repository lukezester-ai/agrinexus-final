import { embedTextsOpenAI, readOpenAiEmbeddingModel } from './ml/embeddings-openai.js';
import { isOpenAiConfigured } from './openai-api-key.js';
import { searchDiscoveryEmbeddings } from './doc-discovery/vector-db.js';
import { rerankSemanticResultsDl } from './doc-discovery/dl-rerank.js';

function bearerToken(authHeader: string | undefined): string | null {
	if (!authHeader || typeof authHeader !== 'string') return null;
	const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
	return m?.[1]?.trim() ?? null;
}

function parseLimit(raw: string | null | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return 10;
	return Math.min(25, Math.max(1, Math.floor(n)));
}

function parseFlag(raw: string | null | undefined): boolean {
	const s = String(raw ?? '').trim().toLowerCase();
	return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export async function handleDocDiscoverySearchRequest(opts: {
	method: string;
	queryParams: URLSearchParams;
	authHeader?: string | undefined;
}): Promise<{ status: number; body: Record<string, unknown> }> {
	if (opts.method !== 'GET') {
		return { status: 405, body: { ok: false, error: 'Method not allowed' } };
	}

	const searchSecret = process.env.DOC_DISCOVERY_SEARCH_SECRET?.trim();
	if (searchSecret) {
		const tok = bearerToken(opts.authHeader);
		if (tok !== searchSecret) {
			return {
				status: 401,
				body: {
					ok: false,
					error: 'Изисква се Authorization: Bearer при зададен DOC_DISCOVERY_SEARCH_SECRET.',
				},
			};
		}
	}

	const q = opts.queryParams.get('q')?.trim() ?? '';
	if (!q) {
		return {
			status: 400,
			body: { ok: false, error: 'Липсва параметър q (текстово запитване на български или английски).' },
		};
	}

	if (!isOpenAiConfigured()) {
		return {
			status: 503,
			body: {
				ok: false,
				error: 'OPENAI_API_KEY липсва — нужен е за embedding модела (семантично търсене).',
			},
		};
	}

	const limit = parseLimit(opts.queryParams.get('limit'));
	const dlRerankEnabled = parseFlag(opts.queryParams.get('dl')) || process.env.DOC_DISCOVERY_DL_RERANK === '1';

	try {
		const [queryEmbedding] = await embedTextsOpenAI([q]);
		const res = await searchDiscoveryEmbeddings(queryEmbedding, limit);
		if (!res.ok) {
			return {
				status: 503,
				body: {
					ok: false,
					error: res.error,
					hint: 'Пусни supabase-doc-discovery-vectors.sql и провери таблицата + функцията match_doc_discovery_embeddings.',
				},
			};
		}

		const rr = dlRerankEnabled ? await rerankSemanticResultsDl(q, res.rows) : null;
		const results = rr?.applied ? rr.rows.slice(0, limit) : res.rows;

		return {
			status: 200,
			body: {
				ok: true,
				kind: 'semantic_ml',
				model: readOpenAiEmbeddingModel(),
				query: q,
				limit,
				results,
				dl: {
					requested: dlRerankEnabled,
					applied: rr?.applied ?? false,
					rerankModel: rr?.model,
					note: rr?.error,
				},
			},
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { status: 502, body: { ok: false, error: msg } };
	}
}
