/**
 * End-to-end RAG ingest:
 * - runs Doc Discovery crawl/scoring
 * - indexes discovery rows into pgvector (embeddings)
 * - prints compact summary for quick verification
 *
 * Usage:
 *   npm run ingest:rag
 *   npm run ingest:rag -- --max-docs=50
 */
import { config } from 'dotenv';
import { runDocDiscoveryJob } from '../lib/doc-discovery/run-job.js';

function readNumberArg(name: string): number | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return null;
  const n = Number(arg.slice(prefix.length).trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'DOC_DISCOVERY_EMBEDDINGS',
  'DOC_DISCOVERY_VECTOR_DIM',
  'DOC_DISCOVERY_ML_INDEX',
  'DOC_DISCOVERY_ML_MAX_DOCS_PER_RUN',
]) {
  delete process.env[key];
}
config();

if (!process.env.DOC_DISCOVERY_ML_INDEX?.trim()) {
  process.env.DOC_DISCOVERY_ML_INDEX = '1';
}

const maxDocs = readNumberArg('max-docs');
if (maxDocs) {
  process.env.DOC_DISCOVERY_ML_MAX_DOCS_PER_RUN = String(maxDocs);
}

const result = await runDocDiscoveryJob();
const mlIndex = result.mlIndex;

console.log('Doc Discovery run:', result.runAt);
console.log('Scanned sources:', result.sourcesScanned);
console.log('Fetch attempted:', result.sourcesFetchAttempted);
console.log('Cooldown skipped:', result.sourcesSkippedCooldown);
console.log('Discovered docs:', result.discovered.length);
console.log('State persisted:', result.persisted ? 'yes' : 'no');
if (result.persistError) {
  console.log('Persist error:', result.persistError);
}

if (!mlIndex?.enabled) {
  console.log('ML index: disabled (set DOC_DISCOVERY_ML_INDEX=1)');
  process.exit(2);
}

console.log(
  `ML index: indexed=${mlIndex.indexed}, model=${mlIndex.model || '(unknown)'}`,
);

if (mlIndex.error) {
  console.error('ML index error:', mlIndex.error);
  process.exit(1);
}

if (!result.persisted) {
  process.exit(1);
}

if (mlIndex.indexed === 0) {
  console.log('No embeddings were indexed (no discoveries this run).');
  process.exit(2);
}

console.log('OK: RAG ingest completed successfully.');
