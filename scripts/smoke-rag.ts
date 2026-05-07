import { buildDocDiscoveryRagContextForChat } from '../lib/doc-discovery-chat-rag.js';

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

  const rag = await buildDocDiscoveryRagContextForChat(query, locale);
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
