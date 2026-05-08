/**
 * Изтегля и индексира **реалното съдържание** на документи от
 * `doc_discovery_embeddings` (locallyseed-нати + crawled публични).
 *
 * Pipeline за всеки документ: fetch (file://docs или https) → parse (PDF/HTML)
 * → chunk → Mistral embed → upsert в `doc_discovery_chunks`.
 *
 * Идемпотентен: ако content_hash на първия чънк не е променен, документът се пропуска.
 *
 * Usage:
 *   npm run fetch:docs                  # обработва до 50 най-нови known URLs
 *   npm run fetch:docs -- --limit=20    # обработва до 20
 *   npm run fetch:docs -- --force       # пренаправи дори при unchanged hash
 *   npm run fetch:docs -- --only-local  # само /docs/* (без HTTP)
 *   npm run fetch:docs -- --url=https://...  # само даден URL (override)
 */
import { config } from 'dotenv';

for (const key of [
	'SUPABASE_URL',
	'SUPABASE_SERVICE_ROLE_KEY',
	'MISTRAL_API_KEY',
	'OPENAI_API_KEY',
	'DOC_DISCOVERY_EMBEDDINGS',
	'DOC_DISCOVERY_VECTOR_DIM',
	'CONTENT_FETCH_TIMEOUT_MS',
	'CONTENT_MAX_BYTES',
]) {
	delete process.env[key];
}
config();

const {
	indexDocumentContent,
	loadKnownDocsForContentIndexing,
} = await import('../lib/doc-discovery/content/pipeline.js');

function readArg(name: string): string | null {
	const prefix = `--${name}=`;
	const arg = process.argv.find(a => a.startsWith(prefix));
	if (!arg) return null;
	return arg.slice(prefix.length).trim();
}

function readFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

const limit = Number(readArg('limit') ?? '50') || 50;
const force = readFlag('force');
const onlyLocal = readFlag('only-local');
const onlyUrl = readArg('url');

let docs: Array<{ url: string; title?: string; topicId?: string; sourceId?: string }>;
if (onlyUrl) {
	docs = [{ url: onlyUrl }];
} else {
	docs = await loadKnownDocsForContentIndexing(limit);
	if (onlyLocal) docs = docs.filter(d => d.url.startsWith('/'));
}

if (docs.length === 0) {
	console.log('Няма URL-и за обработка. Изпълни първо `npm run seed:rag`.');
	process.exit(2);
}

console.log(`Ще обработя ${docs.length} документа (force=${force ? 'yes' : 'no'})...`);

let indexed = 0;
let unchanged = 0;
let empty = 0;
let failed = 0;
let totalChunks = 0;
let totalBytes = 0;
let modelUsed = '';

for (let i = 0; i < docs.length; i++) {
	const d = docs[i];
	process.stdout.write(`[${i + 1}/${docs.length}] ${d.url} ... `);
	const r = await indexDocumentContent(d, { force });
	if (r.status === 'indexed') {
		indexed++;
		totalChunks += r.chunks;
		totalBytes += r.bytes;
		if (r.model) modelUsed = r.model;
		console.log(`OK (${r.chunks} chunks, ${(r.bytes / 1024).toFixed(1)} KB)`);
	} else if (r.status === 'unchanged') {
		unchanged++;
		console.log('пропуснат (непроменен)');
	} else if (r.status === 'empty') {
		empty++;
		console.log('празен текст');
	} else {
		failed++;
		console.log(`FAIL — ${r.error ?? '(unknown)'}`);
	}
}

console.log('\n== Content RAG Summary ==');
console.log(`Indexed:   ${indexed}`);
console.log(`Unchanged: ${unchanged}`);
console.log(`Empty:     ${empty}`);
console.log(`Failed:    ${failed}`);
console.log(`Chunks:    ${totalChunks}`);
console.log(`Total KB:  ${(totalBytes / 1024).toFixed(1)}`);
if (modelUsed) console.log(`Model:     ${modelUsed}`);

if (failed > 0 && indexed === 0 && unchanged === 0) process.exit(1);
process.exit(0);
