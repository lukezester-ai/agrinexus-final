import { embedTextsOpenAI, readOpenAiEmbeddingModel } from './embeddings-openai.js';
import { embedTextsMistral, readMistralEmbeddingModel } from './embeddings-mistral.js';
import { isOpenAiConfigured } from '../openai-api-key.js';
import { isMistralConfigured } from '../mistral-env.js';

export type DiscoveryEmbedProvider = 'mistral' | 'openai';

/**
 * Избор на доставчик за doc-discovery embeddings.
 * По подразбиране: Mistral ако има MISTRAL_API_KEY, иначе OpenAI при OPENAI_API_KEY.
 * Override: DOC_DISCOVERY_EMBEDDINGS=mistral|openai
 */
export function resolveDiscoveryEmbedProvider(): DiscoveryEmbedProvider | null {
	const raw = process.env.DOC_DISCOVERY_EMBEDDINGS?.trim().toLowerCase();
	if (raw === 'mistral') {
		return isMistralConfigured() ? 'mistral' : null;
	}
	if (raw === 'openai') {
		return isOpenAiConfigured() ? 'openai' : null;
	}
	if (raw && raw !== 'auto') {
		return null;
	}
	if (isMistralConfigured()) return 'mistral';
	if (isOpenAiConfigured()) return 'openai';
	return null;
}

export function discoveryEmbeddingsConfigured(): boolean {
	return resolveDiscoveryEmbedProvider() !== null;
}

/** Очаквана размерност за pgvector колоната (трябва да съвпада с избрания SQL migration). */
export function expectedEmbeddingDims(provider: DiscoveryEmbedProvider): number {
	const n = Number(process.env.DOC_DISCOVERY_VECTOR_DIM);
	if (Number.isFinite(n) && n > 0) return Math.floor(n);
	return provider === 'mistral' ? 1024 : 1536;
}

export async function embedTextsForDiscovery(texts: string[]): Promise<{
	vectors: number[][];
	provider: DiscoveryEmbedProvider;
	model: string;
}> {
	const provider = resolveDiscoveryEmbedProvider();
	if (!provider) {
		throw new Error(
			'Няма embeddings доставчик: задай MISTRAL_API_KEY (EU, препоръчително за проекта) или OPENAI_API_KEY; опционално DOC_DISCOVERY_EMBEDDINGS=mistral|openai.',
		);
	}

	const dims = expectedEmbeddingDims(provider);
	let vectors: number[][];
	let model: string;

	if (provider === 'mistral') {
		model = readMistralEmbeddingModel();
		vectors = await embedTextsMistral(texts);
	} else {
		model = readOpenAiEmbeddingModel();
		vectors = await embedTextsOpenAI(texts);
	}

	for (let i = 0; i < vectors.length; i++) {
		const len = vectors[i]?.length ?? 0;
		if (len !== dims) {
			throw new Error(
				`Embedding размерност ${len}, очаквана ${dims} (${provider}). Настрой DOC_DISCOVERY_VECTOR_DIM или ползвай правилния SQL: Mistral → supabase-doc-discovery-vectors-mistral.sql; OpenAI → supabase-doc-discovery-vectors.sql.`,
			);
		}
	}

	return { vectors, provider, model };
}
