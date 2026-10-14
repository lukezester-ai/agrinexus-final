import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Chunk = { id: string; text: string };

const knowledgePath = join(dirname(fileURLToPath(import.meta.url)), 'furrow-agent-knowledge.json');

let cached: Chunk[] | null = null;

function loadChunks(): Chunk[] {
	if (cached) return cached;
	const raw = JSON.parse(readFileSync(knowledgePath, 'utf8')) as { chunks?: Chunk[] };
	cached = Array.isArray(raw.chunks) ? raw.chunks : [];
	return cached;
}

export function buildFurrowKnowledgeContext(query: string): string {
	const q = query.toLowerCase();
	const chunks = loadChunks();
	const scored = chunks.map((c) => {
		const t = c.text.toLowerCase();
		let score = 0;
		for (const w of q.split(/\s+/).filter((x) => x.length > 3)) {
			if (t.includes(w)) score += 1;
		}
		return { c, score };
	});
	scored.sort((a, b) => b.score - a.score);
	const top = (scored[0]?.score ? scored : scored.map((x, i) => ({ ...x, score: chunks.length - i })))
		.filter((x) => x.score > 0)
		.slice(0, 5)
		.map((x) => x.c);
	const use = top.length ? top : chunks.slice(0, 4);
	return use.map((c) => `• [${c.id}] ${c.text}`).join('\n');
}

export function getKnowledgeChunkIds(query: string): string[] {
	const q = query.toLowerCase();
	return loadChunks()
		.filter((c) => q.split(/\s+/).some((w) => w.length > 3 && c.text.toLowerCase().includes(w)))
		.map((c) => c.id)
		.slice(0, 5);
}
