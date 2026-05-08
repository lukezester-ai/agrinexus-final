import { discoveryEmbeddingsConfigured, embedTextsForDiscovery } from './ml/embeddings-discovery.js';
import { searchDiscoveryEmbeddings } from './doc-discovery/vector-db.js';
import { searchContentChunks } from './doc-discovery/content/search.js';

const MAX_RAG_CHARS = 6800;
const TOP_K_META = 6;
const TOP_K_CONTENT = 6;
const MAX_SNIPPET_CHARS = 700;
const MIN_QUERY_CHARS = 10;

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

/**
 * Текст за system prompt: реални откъси (`doc_discovery_chunks`) + насочващи URL-и
 * (`doc_discovery_embeddings`). Ако content chunks таблицата е празна, отстъпва
 * към само-метаданни (старото поведение).
 */
export async function buildDocDiscoveryRagContextForChat(
	userQuery: string,
	locale: 'bg' | 'en',
): Promise<string> {
	if (!chatRagEnabled()) return '';
	const q = userQuery.trim().replace(/\s+/g, ' ');
	if (q.length < MIN_QUERY_CHARS) return '';
	if (!discoveryEmbeddingsConfigured()) return '';

	try {
		const { vectors } = await embedTextsForDiscovery([q]);
		const emb = vectors[0];
		if (!emb?.length) return '';

		const [contentRes, metaRes] = await Promise.all([
			searchContentChunks(emb, TOP_K_CONTENT),
			searchDiscoveryEmbeddings(emb, TOP_K_META),
		]);

		const contentRows = contentRes.ok ? contentRes.rows : [];
		const metaRows = metaRes.ok ? metaRes.rows : [];

		if (contentRows.length === 0 && metaRows.length === 0) return '';

		const seenUrls = new Set<string>();
		const lines: string[] = [];

		if (contentRows.length > 0) {
			lines.push(
				locale === 'bg'
					? '=== RETRIEVED CONTENT (откъси от индексирани документи; цитирай URL и не измисляй детайли) ==='
					: '=== RETRIEVED CONTENT (excerpts from indexed documents; cite URL and do not invent details) ===',
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
					? '=== RELATED DOCUMENTS (заглавия/линкове без съдържание; ако е приложимо, насочи потребителя да отвори линка) ==='
					: '=== RELATED DOCUMENTS (titles/links without content; if relevant, point the user to the link) ===',
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
				? 'Не измисляй съдържание — ако твърдиш факт, той трябва да присъства в RETRIEVED CONTENT по-горе. Винаги напомняй на потребителя да провери на официалния източник.'
				: 'Do not fabricate content — any claim must appear in RETRIEVED CONTENT above. Always remind the user to verify on the official source.';
		lines.push('', footer);

		let block = lines.join('\n');
		if (block.length > MAX_RAG_CHARS) {
			block = `${block.slice(0, MAX_RAG_CHARS)}\n…`;
		}
		return block;
	} catch {
		return '';
	}
}
