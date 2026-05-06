import { getSupabaseServiceClient } from '../infra/supabase-service.js';
import type { DiscoveredDocLink } from './types.js';

export type VectorSearchRow = {
	id: string;
	url: string;
	title: string | null;
	topic_id: string | null;
	source_id: string | null;
	similarity: number;
};

/**
 * Upsert на документни записи с embedding (pgvector).
 * Очаква колона `embedding vector(1536)` и модел text-embedding-3-small (или същото измерение).
 */
export async function upsertDiscoveryEmbeddings(
	rows: Array<{
		url: string;
		title: string;
		topicId: string;
		sourceId: string;
		embedding: number[];
		model: string;
	}>,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const client = getSupabaseServiceClient();
	if (!client) return { ok: false, error: 'Supabase service client не е конфигуриран' };
	if (rows.length === 0) return { ok: true };

	const payload = rows.map(r => ({
		url: r.url,
		title: r.title,
		topic_id: r.topicId,
		source_id: r.sourceId,
		embedding: r.embedding,
		model: r.model,
		updated_at: new Date().toISOString(),
	}));

	const { error } = await client.from('doc_discovery_embeddings').upsert(payload as never, {
		onConflict: 'url',
	});

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

/** Семантично търсене чрез RPC `match_doc_discovery_embeddings` */
export async function searchDiscoveryEmbeddings(
	queryEmbedding: number[],
	matchCount: number,
): Promise<{ ok: true; rows: VectorSearchRow[] } | { ok: false; error: string }> {
	const client = getSupabaseServiceClient();
	if (!client) return { ok: false, error: 'Supabase service client не е конфигуриран' };

	const { data, error } = await client.rpc('match_doc_discovery_embeddings', {
		query_embedding: queryEmbedding,
		match_count: matchCount,
	});

	if (error) return { ok: false, error: error.message };

	const rows = Array.isArray(data) ? data : [];
	const normalized: VectorSearchRow[] = rows.map((r: Record<string, unknown>) => ({
		id: String(r.id ?? ''),
		url: String(r.url ?? ''),
		title: r.title != null ? String(r.title) : null,
		topic_id: r.topic_id != null ? String(r.topic_id) : null,
		source_id: r.source_id != null ? String(r.source_id) : null,
		similarity: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity) || 0,
	}));

	return { ok: true, rows: normalized };
}

export function discoveryToEmbedText(d: DiscoveredDocLink): string {
	const extras = d.matchedExtras?.length ? ` Ключови: ${d.matchedExtras.slice(0, 12).join(', ')}.` : '';
	return `Тема: ${d.topicId}. ${d.title}.${extras} URL: ${d.url}`;
}
