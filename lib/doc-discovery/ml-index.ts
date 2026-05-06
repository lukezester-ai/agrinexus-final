import { embedTextsForDiscovery } from '../ml/embeddings-discovery.js';
import type { DiscoveredDocLink } from './types.js';
import { discoveryToEmbedText, upsertDiscoveryEmbeddings } from './vector-db.js';

const DEFAULT_BATCH = 16;

/**
 * Индексира открити документи за семантично търсене (embeddings → pgvector).
 */
export async function indexDiscoveriesForMl(
	discovered: DiscoveredDocLink[],
	maxDocs: number,
): Promise<{ indexed: number; model: string; error?: string }> {
	const slice = discovered.slice(0, Math.max(0, maxDocs));
	if (slice.length === 0) return { indexed: 0, model: '' };

	const batchSize = Math.max(1, DEFAULT_BATCH);
	let indexed = 0;
	let model = '';

	try {
		for (let i = 0; i < slice.length; i += batchSize) {
			const batch = slice.slice(i, i + batchSize);
			const texts = batch.map(discoveryToEmbedText);
			const { vectors, model: batchModel } = await embedTextsForDiscovery(texts);
			model = batchModel;

			const rows = batch.map((d, j) => ({
				url: d.url,
				title: d.title,
				topicId: d.topicId,
				sourceId: d.sourceId,
				embedding: vectors[j]!,
				model,
			}));

			const up = await upsertDiscoveryEmbeddings(rows);
			if (!up.ok) {
				return { indexed, model, error: up.error };
			}
			indexed += rows.length;
		}
		return { indexed, model };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { indexed, model, error: msg };
	}
}
