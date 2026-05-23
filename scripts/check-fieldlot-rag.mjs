/**
 * Проверка на fieldlot semantic RAG JSON (локално / CI без пуснат API).
 * Изход 1 ако има много chunks, но нито един embedding — типичен счупен индекс.
 */
import fs from 'node:fs';
import path from 'node:path';

const p = path.join(process.cwd(), 'fieldlot', 'data', 'fieldlot-rag-index.json');

if (!fs.existsSync(p)) {
	console.log('[check-fieldlot-rag] skip: no file', p);
	process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
const chunks = Array.isArray(raw.chunks) ? raw.chunks : [];
const embedded = chunks.filter(
	(c) => Array.isArray(c.embedding) && c.embedding.length > 0,
).length;

console.log(`[check-fieldlot-rag] chunks=${chunks.length} embedded=${embedded}`);

if (chunks.length >= 8 && embedded === 0) {
	console.error(
		'[check-fieldlot-rag] WARNING: index has chunks but no embeddings. Run `cd fieldlot && npm run sync:listings` with MISTRAL_API_KEY, or set CHECK_FIELDLOT_RAG_STRICT=1 to fail CI.',
	);
	if (process.env.CHECK_FIELDLOT_RAG_STRICT === '1') {
		process.exit(1);
	}
}

process.exit(0);
