/**
 * Семантично търсене върху чънкове на реално съдържание (`doc_discovery_chunks`).
 * Използва RPC `match_doc_discovery_chunks(query_embedding, match_count, similarity_threshold)`.
 */
import { getSupabaseServiceClient } from '../../infra/supabase-service.js';

export type ContentChunkRow = {
	id: string;
	url: string;
	title: string | null;
	topicId: string | null;
	sourceId: string | null;
	chunkIndex: number;
	content: string;
	similarity: number;
};

export async function searchContentChunks(
	queryEmbedding: number[],
	matchCount: number,
	similarityThreshold = 0.55,
): Promise<{ ok: true; rows: ContentChunkRow[] } | { ok: false; error: string }> {
	const client = getSupabaseServiceClient();
	if (!client) return { ok: false, error: 'Supabase service client не е конфигуриран' };

	const { data, error } = await client.rpc('match_doc_discovery_chunks', {
		query_embedding: queryEmbedding,
		match_count: matchCount,
		similarity_threshold: similarityThreshold,
	});
	if (error) return { ok: false, error: error.message };

	const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
	const normalized: ContentChunkRow[] = rows.map(r => ({
		id: String(r.id ?? ''),
		url: String(r.url ?? ''),
		title: r.title != null ? String(r.title) : null,
		topicId: r.topic_id != null ? String(r.topic_id) : null,
		sourceId: r.source_id != null ? String(r.source_id) : null,
		chunkIndex: typeof r.chunk_index === 'number' ? r.chunk_index : Number(r.chunk_index) || 0,
		content: String(r.content ?? ''),
		similarity: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity) || 0,
	}));

	return { ok: true, rows: normalized };
}
