import { readMistralApiKey } from '../mistral-env.js';
import { truncateForEmbedding } from './embeddings-openai.js';

const MISTRAL_EMBEDDINGS_URL = 'https://api.mistral.ai/v1/embeddings';

/** Текстов модел за RAG — вектор 1024 по подразбиране (съвместим с pgvector migration за Mistral). */
export function readMistralEmbeddingModel(): string {
	return process.env.MISTRAL_EMBEDDING_MODEL?.trim() || 'mistral-embed';
}

/**
 * Batch embeddings през Mistral API (OpenAI-съвместим /v1/embeddings).
 * Размерността зависи от модела (mistral-embed: 1024 по подразбиране).
 */
export async function embedTextsMistral(texts: string[]): Promise<number[][]> {
	const key = readMistralApiKey();
	if (!key) throw new Error('MISTRAL_API_KEY липсва за embeddings');
	if (texts.length === 0) return [];

	const model = readMistralEmbeddingModel();
	const cleaned = texts.map(t => truncateForEmbedding(t));

	const res = await fetch(MISTRAL_EMBEDDINGS_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ model, input: cleaned }),
	});

	const raw = await res.text();
	let data: {
		error?: { message?: string };
		data?: Array<{ index?: number; embedding?: number[] }>;
	};
	try {
		data = JSON.parse(raw) as typeof data;
	} catch {
		throw new Error(`Mistral embeddings: невалиден JSON (${res.status})`);
	}

	if (!res.ok) {
		throw new Error(data.error?.message || `Mistral embeddings HTTP ${res.status}`);
	}

	const rows = data.data;
	if (!Array.isArray(rows)) throw new Error('Mistral embeddings: липсва data[]');

	const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
	const out: number[][] = [];
	for (let i = 0; i < sorted.length; i++) {
		const emb = sorted[i]?.embedding;
		if (!Array.isArray(emb) || emb.length === 0) {
			throw new Error(`Mistral embeddings: празен вектор при индекс ${i}`);
		}
		out.push(emb);
	}
	if (out.length !== texts.length) {
		throw new Error(`Mistral embeddings: очаквани ${texts.length} вектора, получени ${out.length}`);
	}
	return out;
}
