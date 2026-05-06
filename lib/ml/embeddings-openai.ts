import { readOpenAiApiKey } from '../openai-api-key.js';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/** Стандартен embedding модел за семантично търсене (OpenAI). Измерение 1536. */
export function readOpenAiEmbeddingModel(): string {
	return process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
}

export function isOpenAiEmbeddingsConfigured(): boolean {
	return Boolean(readOpenAiApiKey());
}

/** Обобщава текст за embedding (лимит на токени приблизително). */
export function truncateForEmbedding(text: string, maxChars = 7500): string {
	const t = text.trim().replace(/\s+/g, ' ');
	return t.length <= maxChars ? t : `${t.slice(0, maxChars)}…`;
}

/**
 * Batch embeddings през OpenAI API — истински ML модел за текст към вектор.
 * Връща вектори в същия ред като входните низове.
 */
export async function embedTextsOpenAI(texts: string[]): Promise<number[][]> {
	const key = readOpenAiApiKey();
	if (!key) throw new Error('OPENAI_API_KEY липсва за embeddings');
	if (texts.length === 0) return [];

	const model = readOpenAiEmbeddingModel();
	const cleaned = texts.map(t => truncateForEmbedding(t));

	const res = await fetch(OPENAI_EMBEDDINGS_URL, {
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
		throw new Error(`OpenAI embeddings: невалиден JSON (${res.status})`);
	}

	if (!res.ok) {
		throw new Error(data.error?.message || `OpenAI embeddings HTTP ${res.status}`);
	}

	const rows = data.data;
	if (!Array.isArray(rows)) throw new Error('OpenAI embeddings: липсва data[]');

	const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
	const out: number[][] = [];
	for (let i = 0; i < sorted.length; i++) {
		const emb = sorted[i]?.embedding;
		if (!Array.isArray(emb) || emb.length === 0) {
			throw new Error(`OpenAI embeddings: празен вектор при индекс ${i}`);
		}
		out.push(emb);
	}
	if (out.length !== texts.length) {
		throw new Error(`OpenAI embeddings: очаквани ${texts.length} вектора, получени ${out.length}`);
	}
	return out;
}
