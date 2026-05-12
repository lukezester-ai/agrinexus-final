import type { AssistantRagRetrievalHints } from './assistant-rag-retrieval.js';
import { discoveryEmbeddingsConfigured, embedTextsForDiscovery } from './ml/embeddings-discovery.js';
import { searchDiscoveryEmbeddings, type VectorSearchRow } from './doc-discovery/vector-db.js';
import { searchContentChunks, type ContentChunkRow } from './doc-discovery/content/search.js';
import { MAX_DOC_DISCOVERY_RAG_CHARS } from './rag-limits.js';

const TOP_K_META = 12;
const TOP_K_CONTENT = 12;
const MAX_SNIPPET_CHARS = 1000;
const MIN_QUERY_CHARS = 2;
const MAX_EMBED_QUERY_CHARS = 8000;

function chatRagEnabled(): boolean {
	const v = process.env.CHAT_DOC_DISCOVERY_RAG?.trim().toLowerCase();
	if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
	if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
	return discoveryEmbeddingsConfigured();
}

/** За GET /api/chat — дали при подходящо потребителско запитване ще се прави retrieval към pgvector. */
export function chatDocDiscoveryRagFeatureEnabled(): boolean {
	return chatRagEnabled();
}

function clipSnippet(text: string, maxChars: number): string {
	const t = text.replace(/\s+/g, ' ').trim();
	if (t.length <= maxChars) return t;
	return `${t.slice(0, maxChars - 1)}…`;
}

function preferTopics<T extends { similarity: number }>(
	rows: T[],
	topicIds: string[] | null | undefined,
	getTopic: (r: T) => string | null,
): T[] {
	if (!topicIds?.length) return rows;
	const set = new Set(topicIds);
	return [...rows].sort((a, b) => {
		const ta = getTopic(a);
		const tb = getTopic(b);
		const pa = ta && set.has(ta) ? 1 : 0;
		const pb = tb && set.has(tb) ? 1 : 0;
		if (pa !== pb) return pb - pa;
		return b.similarity - a.similarity;
	});
}

/**
 * Текст за system prompt: реални откъси (`doc_discovery_chunks`) + насочващи URL-и
 * (`doc_discovery_embeddings`). Ако content chunks таблицата е празна, отстъпва
 * към само-метаданни (старото поведение).
 *
 * @param hints Опционално от бърз въпрос (`ragPromptId`): удебелява embedding заявката и пренарежда по `topic_id`.
 */
export async function buildDocDiscoveryRagContextForChat(
	userQuery: string,
	locale: 'bg' | 'en',
	hints?: AssistantRagRetrievalHints | null,
): Promise<string> {
	if (!chatRagEnabled()) return '';
	const qBase = userQuery.trim().replace(/\s+/g, ' ');
	if (qBase.length < MIN_QUERY_CHARS) return '';
	if (!discoveryEmbeddingsConfigured()) return '';

	const embedSource = hints?.embedAugment?.trim()
		? `${qBase}\n\n--- retrieval focus ---\n${hints.embedAugment.trim()}`.replace(/\s+/g, ' ').trim()
		: qBase;
	const q = embedSource.slice(0, MAX_EMBED_QUERY_CHARS);

	try {
		const { vectors } = await embedTextsForDiscovery([q]);
		const emb = vectors[0];
		if (!emb?.length) return '';

		const [contentRes, metaRes] = await Promise.all([
			searchContentChunks(emb, TOP_K_CONTENT),
			searchDiscoveryEmbeddings(emb, TOP_K_META),
		]);

		let contentRows: ContentChunkRow[] = contentRes.ok ? contentRes.rows : [];
		let metaRows: VectorSearchRow[] = metaRes.ok ? metaRes.rows : [];

		if (hints?.topicIds?.length) {
			contentRows = preferTopics(contentRows, hints.topicIds, r => r.topicId);
			metaRows = preferTopics(metaRows, hints.topicIds, r => r.topic_id);
		}

		if (contentRows.length === 0 && metaRows.length === 0) return '';

		const seenUrls = new Set<string>();
		const lines: string[] = [];

		if (contentRows.length > 0) {
			lines.push(
				locale === 'bg'
					? '=== RAG-LED — RETRIEVED CONTENT (откъси от индексирани документи; води отговора за факти; цитирай URL; не измисляй детайли) ==='
					: '=== RAG-LED — RETRIEVED CONTENT (indexed excerpts; lead factual answers from here; cite URL; do not invent details) ===',
			);
			for (const r of contentRows) {
				const sim = (Math.min(1, Math.max(0, r.similarity)) * 100).toFixed(1);
				const title = (r.title ?? '').trim() || r.url;
				const topic = r.topicId ? ` [topic: ${r.topicId}]` : '';
				const snippet = clipSnippet(r.content, MAX_SNIPPET_CHARS);
				lines.push(
					`- (${sim}%) ${title}${topic}\n  URL: ${r.url}\n  > ${snippet}`,
				);
				seenUrls.add(r.url);
			}
			lines.push('');
		}

		const remainingMeta = metaRows.filter(m => !seenUrls.has(m.url));
		if (remainingMeta.length > 0) {
			lines.push(
				locale === 'bg'
					? '=== RAG-LED — RELATED DOCUMENTS (заглавия/линкове; ползвай за навигация и допълване след RETRIEVED CONTENT) ==='
					: '=== RAG-LED — RELATED DOCUMENTS (titles/links; use for navigation and follow-up after RETRIEVED CONTENT) ===',
			);
			for (const r of remainingMeta) {
				const sim = (Math.min(1, Math.max(0, r.similarity)) * 100).toFixed(1);
				const title = (r.title ?? '').trim() || r.url;
				const topic = r.topic_id ? ` [topic: ${r.topic_id}]` : '';
				lines.push(`- (${sim}%) ${title}${topic}\n  URL: ${r.url}`);
			}
		}

		const footer =
			locale === 'bg'
				? 'RAG-led: не твърди факт извън показаните откъси; ако въпросът не е покрит — кажи че индексът няма отговор и насочи към официален източник.'
				: 'RAG-led: do not state a fact not supported by the excerpts shown; if the question is not covered — say the index has no match and point to an official source.';
		lines.push('', footer);

		let block = lines.join('\n');
		if (block.length > MAX_DOC_DISCOVERY_RAG_CHARS) {
			block = `${block.slice(0, MAX_DOC_DISCOVERY_RAG_CHARS)}\n…`;
		}
		return block;
	} catch {
		return '';
	}
}
