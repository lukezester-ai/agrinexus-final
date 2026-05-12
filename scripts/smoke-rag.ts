import { config } from 'dotenv';

for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'CHAT_DOC_DISCOVERY_RAG',
  'DOC_DISCOVERY_EMBEDDINGS',
  'DOC_DISCOVERY_VECTOR_DIM',
]) {
  delete process.env[key];
}
config();

const { buildDocDiscoveryRagContextForChat } = await import(
	'../lib/doc-discovery-chat-rag.js'
);
const { resolveAssistantRagRetrieval } = await import('../lib/assistant-rag-retrieval.js');

function readArg(name: string, fallback = ''): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  return hit.slice(prefix.length).trim();
}

async function main() {
  const query =
    readArg('query') ||
    'Какви документи и срокове трябва да следя за субсидии при зърнопроизводство?';
  const locale = readArg('locale', 'bg') === 'en' ? 'en' : 'bg';

  const promptId = readArg('promptId', '');
  const hints = promptId ? resolveAssistantRagRetrieval(promptId) : null;
  if (promptId && !hints) {
    console.error(`Unknown --promptId=${promptId}. Use one of the young-farmer quick prompt ids (e.g. yf-cap-entry).`);
    process.exit(2);
  }

  const rag = await buildDocDiscoveryRagContextForChat(query, locale, hints);
  if (!rag.trim()) {
    console.log('RAG context is empty.');
    console.log('Check: CHAT_DOC_DISCOVERY_RAG, embedding provider keys, and indexed vectors.');
    process.exit(2);
  }

  console.log('RAG context generated successfully:\n');
  console.log(rag);
}

main().catch((error) => {
  console.error('[smoke-rag] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
