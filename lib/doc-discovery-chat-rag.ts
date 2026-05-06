import { discoveryEmbeddingsConfigured, embedTextsForDiscovery } from './ml/embeddings-discovery.js';
import { searchDiscoveryEmbeddings } from './doc-discovery/vector-db.js';

const MAX_RAG_CHARS = 4800;
const TOP_K = 8;
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

/**
 * Текст за system prompt: последни намерени публични документи (pgvector), без да се тегли HTML.
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

		const res = await searchDiscoveryEmbeddings(emb, TOP_K);
		if (!res.ok || res.rows.length === 0) return '';

		const header =
			locale === 'bg'
				? '=== RETRIEVAL SNIPPETS (автоматично подбор по смисъл от индексирани публични страници; задължително насочи потребителя да потвърди на официалния сайт) ==='
				: '=== RETRIEVAL SNIPPETS (semantic rank over indexed public pages; instruct user to verify on official sites) ===';

		const lines: string[] = [header];
		for (const r of res.rows) {
			const title = (r.title ?? '').trim() || r.url;
			const topic = r.topic_id ? ` [topic: ${r.topic_id}]` : '';
			lines.push(
				`- (${(Math.min(1, Math.max(0, r.similarity)) * 100).toFixed(1)}%) ${title}${topic}\n  URL: ${r.url}`,
			);
		}

		const footer =
			locale === 'bg'
				? 'Не преписвай „съдържание“ от страниците — имаш само заглавие и линк. Използвай ги за ориентация и за полето source в JSON.'
				: 'Do not fabricate page bodies — you only have titles and links. Use them for orientation and for the JSON source field.';

		lines.push(footer);

		let block = lines.join('\n');
		if (block.length > MAX_RAG_CHARS) {
			block = `${block.slice(0, MAX_RAG_CHARS)}\n…`;
		}
		return block;
	} catch {
		return '';
	}
}
