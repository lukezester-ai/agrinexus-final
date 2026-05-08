/**
 * End-to-end pipeline за индексиране на реалното съдържание на документ:
 *   fetch (local или HTTP) → parse (PDF/HTML/text) → chunk → embed (Mistral) → upsert в pgvector.
 *
 * Идемпотентен: чънкове се upsert-ват по `(url, chunk_index)`. Ако content_hash
 * на първия чънк не е променен от последния път, целият документ се пропуска
 * (предотвратява пресмятане на embeddings за непроменени файлове).
 */
import { createHash } from 'node:crypto';

import { getSupabaseServiceClient } from '../../infra/supabase-service.js';
import { embedTextsForDiscovery } from '../../ml/embeddings-discovery.js';
import { fetchDocument } from './fetcher.js';
import { extractPdfText } from './pdf-parser.js';
import { stripHtmlToText } from './html-stripper.js';
import { chunkText } from './chunker.js';

export type ContentDocInput = {
	url: string;
	title?: string;
	topicId?: string;
	sourceId?: string;
};

export type ContentIndexResult = {
	url: string;
	status: 'indexed' | 'unchanged' | 'empty' | 'failed';
	chunks: number;
	bytes: number;
	model?: string;
	error?: string;
};

const EMBED_BATCH = 16;

function hashContent(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

async function existingHashForUrl(url: string): Promise<string | null> {
	const client = getSupabaseServiceClient();
	if (!client) return null;
	const { data } = await client
		.from('doc_discovery_chunks')
		.select('content_hash')
		.eq('url', url)
		.eq('chunk_index', 0)
		.limit(1)
		.maybeSingle();
	return (data as { content_hash?: string } | null)?.content_hash ?? null;
}

async function deleteExistingChunks(url: string): Promise<void> {
	const client = getSupabaseServiceClient();
	if (!client) return;
	await client.from('doc_discovery_chunks').delete().eq('url', url);
}

async function upsertChunks(
	rows: Array<{
		url: string;
		title: string | null;
		topicId: string | null;
		sourceId: string | null;
		chunkIndex: number;
		content: string;
		contentHash: string;
		embedding: number[];
		model: string;
		byteSize: number;
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
		chunk_index: r.chunkIndex,
		content: r.content,
		content_hash: r.contentHash,
		embedding: r.embedding,
		model: r.model,
		byte_size: r.byteSize,
		updated_at: new Date().toISOString(),
	}));

	const { error } = await client
		.from('doc_discovery_chunks')
		.upsert(payload as never, { onConflict: 'url,chunk_index' });

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

function inferMimeKind(contentType: string, url: string): 'pdf' | 'html' | 'text' {
	const ct = contentType.toLowerCase();
	if (ct.includes('pdf') || /\.pdf(\?|#|$)/i.test(url)) return 'pdf';
	if (ct.includes('html') || ct.includes('xhtml')) return 'html';
	if (ct.includes('text/plain') || /\.txt(\?|#|$)/i.test(url)) return 'text';
	if (/\.html?(\?|#|$)/i.test(url)) return 'html';
	return 'html';
}

function bytesToUtf8(bytes: Uint8Array): string {
	return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

async function extractTextForDoc(
	bytes: Uint8Array,
	contentType: string,
	url: string,
): Promise<{ text: string; titleFromBody: string | null }> {
	const kind = inferMimeKind(contentType, url);
	if (kind === 'pdf') {
		const text = await extractPdfText(bytes);
		return { text, titleFromBody: null };
	}
	if (kind === 'html') {
		const html = bytesToUtf8(bytes);
		const stripped = stripHtmlToText(html);
		return { text: stripped.text, titleFromBody: stripped.title };
	}
	return { text: bytesToUtf8(bytes), titleFromBody: null };
}

/**
 * Индексира съдържанието на един документ. Безопасно е да се вика паралелно
 * за различни URL-и (Supabase upsert е idempotent по `(url, chunk_index)`).
 */
export async function indexDocumentContent(
	doc: ContentDocInput,
	opts: { force?: boolean } = {},
): Promise<ContentIndexResult> {
	const { url } = doc;
	try {
		const fetched = await fetchDocument(url);
		const { text, titleFromBody } = await extractTextForDoc(
			fetched.bytes,
			fetched.contentType,
			url,
		);
		const trimmed = text.trim();
		if (trimmed.length < 80) {
			return { url, status: 'empty', chunks: 0, bytes: fetched.bytes.byteLength };
		}

		const chunks = chunkText(trimmed);
		if (chunks.length === 0) {
			return { url, status: 'empty', chunks: 0, bytes: fetched.bytes.byteLength };
		}

		const firstHash = hashContent(chunks[0]);
		if (!opts.force) {
			const existing = await existingHashForUrl(url);
			if (existing && existing === firstHash) {
				return {
					url,
					status: 'unchanged',
					chunks: 0,
					bytes: fetched.bytes.byteLength,
				};
			}
		}

		await deleteExistingChunks(url);

		const title = doc.title ?? titleFromBody ?? null;
		const topicId = doc.topicId ?? null;
		const sourceId = doc.sourceId ?? null;

		let model = '';
		const rows: Parameters<typeof upsertChunks>[0] = [];
		for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
			const batch = chunks.slice(i, i + EMBED_BATCH);
			const { vectors, model: batchModel } = await embedTextsForDiscovery(batch);
			model = batchModel;
			for (let j = 0; j < batch.length; j++) {
				const content = batch[j];
				rows.push({
					url,
					title,
					topicId,
					sourceId,
					chunkIndex: i + j,
					content,
					contentHash: hashContent(content),
					embedding: vectors[j]!,
					model,
					byteSize: fetched.bytes.byteLength,
				});
			}
		}

		const up = await upsertChunks(rows);
		if (!up.ok) {
			return {
				url,
				status: 'failed',
				chunks: 0,
				bytes: fetched.bytes.byteLength,
				error: up.error,
			};
		}

		return {
			url,
			status: 'indexed',
			chunks: rows.length,
			bytes: fetched.bytes.byteLength,
			model,
		};
	} catch (e) {
		return {
			url,
			status: 'failed',
			chunks: 0,
			bytes: 0,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

/** Зарежда списък с URL-и от `doc_discovery_embeddings` (метаданните, които вече сме seed-нали/обходили). */
export async function loadKnownDocsForContentIndexing(limit = 100): Promise<ContentDocInput[]> {
	const client = getSupabaseServiceClient();
	if (!client) return [];
	const { data, error } = await client
		.from('doc_discovery_embeddings')
		.select('url,title,topic_id,source_id')
		.order('updated_at', { ascending: false })
		.limit(limit);
	if (error || !data) return [];
	return (data as Array<Record<string, unknown>>).map(row => ({
		url: String(row.url ?? ''),
		title: typeof row.title === 'string' ? row.title : undefined,
		topicId: typeof row.topic_id === 'string' ? row.topic_id : undefined,
		sourceId: typeof row.source_id === 'string' ? row.source_id : undefined,
	}));
}
