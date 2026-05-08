/**
 * Разделя дълъг текст на семантични чънкове за RAG индексиране.
 *
 * Алгоритъм:
 *   1) Нормализира whitespace и реди.
 *   2) Първо разделя на параграфи (двоен нов ред).
 *   3) Параграфи > maxChars се разделят на изречения (по `. ! ? \n`).
 *   4) Слепва съседни кратки участъци, докато се доближат до targetChars.
 *   5) Между съседни чънкове добавя overlap от целите последни ~overlapChars символа,
 *      за да не се губят важни фрази по границите.
 *
 * targetChars/maxChars/overlapChars са в **символи**, не токени — Mistral embeddings
 * толерират ~8K символа на вход, но 1.0–1.4K дава най-добрия recall в нашите тестове.
 */

export type ChunkOptions = {
	targetChars?: number;
	maxChars?: number;
	overlapChars?: number;
	minChunkChars?: number;
};

const DEFAULTS = {
	targetChars: 1200,
	maxChars: 1800,
	overlapChars: 200,
	minChunkChars: 200,
};

function normalize(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/\u00a0/g, ' ')
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function splitSentences(paragraph: string, maxChars: number): string[] {
	if (paragraph.length <= maxChars) return [paragraph];
	const parts: string[] = [];
	const sentenceRe = /[^.!?\n]+(?:[.!?]+["'»]?|\n+|$)/g;
	let m: RegExpExecArray | null;
	while ((m = sentenceRe.exec(paragraph)) !== null) {
		const s = m[0].trim();
		if (s) parts.push(s);
	}
	if (parts.length === 0) {
		const out: string[] = [];
		for (let i = 0; i < paragraph.length; i += maxChars) {
			out.push(paragraph.slice(i, i + maxChars));
		}
		return out;
	}
	const expanded: string[] = [];
	for (const p of parts) {
		if (p.length <= maxChars) {
			expanded.push(p);
		} else {
			for (let i = 0; i < p.length; i += maxChars) {
				expanded.push(p.slice(i, i + maxChars));
			}
		}
	}
	return expanded;
}

export function chunkText(rawText: string, opts: ChunkOptions = {}): string[] {
	const { targetChars, maxChars, overlapChars, minChunkChars } = {
		...DEFAULTS,
		...opts,
	};
	const text = normalize(rawText);
	if (text.length === 0) return [];
	if (text.length <= maxChars) return [text];

	const paragraphs = text.split(/\n{2,}/);
	const sentences: string[] = [];
	for (const p of paragraphs) {
		const trimmed = p.trim();
		if (!trimmed) continue;
		for (const s of splitSentences(trimmed, maxChars)) {
			sentences.push(s);
		}
	}

	const chunks: string[] = [];
	let buffer: string[] = [];
	let bufferLen = 0;

	const flush = () => {
		if (bufferLen === 0) return;
		const chunk = buffer.join(' ').trim();
		if (chunk.length >= minChunkChars || chunks.length === 0) {
			chunks.push(chunk);
		} else if (chunks.length > 0) {
			chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${chunk}`.trim();
		}
		buffer = [];
		bufferLen = 0;
	};

	for (const s of sentences) {
		const slen = s.length;
		if (bufferLen + slen + 1 > targetChars && bufferLen > 0) {
			flush();
		}
		buffer.push(s);
		bufferLen += slen + 1;
	}
	flush();

	if (overlapChars <= 0 || chunks.length <= 1) return chunks;

	const withOverlap: string[] = [chunks[0]];
	for (let i = 1; i < chunks.length; i++) {
		const prev = chunks[i - 1];
		const tail = prev.slice(-overlapChars);
		withOverlap.push(`${tail} ${chunks[i]}`.trim());
	}
	return withOverlap;
}
