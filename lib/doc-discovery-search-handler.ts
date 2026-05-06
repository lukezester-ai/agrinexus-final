import {
	discoveryEmbeddingsConfigured,
	embedTextsForDiscovery,
	resolveDiscoveryEmbedProvider,
} from './ml/embeddings-discovery.js';
import { searchDiscoveryEmbeddings } from './doc-discovery/vector-db.js';
import { rerankSemanticResultsDl } from './doc-discovery/dl-rerank.js';
import { isDeployProductionLike } from './deploy-env.js';

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

	if (isDeployProductionLike() && !process.env.DOC_DISCOVERY_SEARCH_SECRET?.trim()) {
		return {
			status: 503,
			body: {
				ok: false,
				error: 'DOC_DISCOVERY_SEARCH_SECRET не е зададен в продукция.',
				hint: 'Задай DOC_DISCOVERY_SEARCH_SECRET във Vercel Environment Variables и подай Authorization: Bearer <същата стойност>.',
			},
		};
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

	if (!discoveryEmbeddingsConfigured()) {
		const forced = process.env.DOC_DISCOVERY_EMBEDDINGS?.trim().toLowerCase();
		const hint =
			forced === 'openai'
				? 'Зададено е DOC_DISCOVERY_EMBEDDINGS=openai — нужен е OPENAI_API_KEY или премахни override и ползвай MISTRAL_API_KEY.'
				: forced === 'mistral'
					? 'Зададено е DOC_DISCOVERY_EMBEDDINGS=mistral — нужен е MISTRAL_API_KEY.'
					: 'Задай MISTRAL_API_KEY (препоръчително) или OPENAI_API_KEY; pgvector таблицата трябва да е със същата размерност (виж .env.example).';
		return {
			status: 503,
			body: {
				ok: false,
				error: 'Няма конфигуриран доставчик за embeddings (семантично търсене).',
				hint,
			},
		};
	}

	const limit = parseLimit(opts.queryParams.get('limit'));
	const dlRerankEnabled = parseFlag(opts.queryParams.get('dl')) || process.env.DOC_DISCOVERY_DL_RERANK === '1';

	try {
		const { vectors, model: embedModel } = await embedTextsForDiscovery([q]);
		const queryEmbedding = vectors[0]!;
		const res = await searchDiscoveryEmbeddings(queryEmbedding, limit);
		if (!res.ok) {
			return {
				status: 503,
				body: {
					ok: false,
					error: res.error,
					hint:
						'Пусни подходящия SQL за pgvector (Mistral: supabase-doc-discovery-vectors-mistral.sql, OpenAI: supabase-doc-discovery-vectors.sql) и провери match_doc_discovery_embeddings.',
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
				embedProvider: resolveDiscoveryEmbedProvider(),
				model: embedModel,
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
