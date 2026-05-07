/**
 * One-shot RAG setup health check:
 * 1) runs end-to-end ingest (discovery + embeddings)
 * 2) runs retrieval smoke test
 * 3) prints compact PASS/FAIL summary
 *
 * Usage:
 *   npm run rag:setup
 *   npm run rag:setup -- --query="..." --locale=bg --max-docs=50
 */
import { spawnSync } from 'node:child_process';

function readArg(name: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
}

function runStep(name: string, command: string, args: string[]) {
  console.log(`\n== ${name} ==`);
  const r = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const code = typeof r.status === 'number' ? r.status : 1;
  return code;
}

const query =
  readArg('query') || 'Какви документи и срокове трябва да следя за субсидии при зърнопроизводство?';
const locale = readArg('locale') === 'en' ? 'en' : 'bg';
const maxDocs = readArg('max-docs');

const ingestArgs = ['run', 'ingest:rag', '--'];
if (maxDocs) ingestArgs.push(`--max-docs=${maxDocs}`);
const ingestExit = runStep('Ingest', 'npm', ingestArgs);

const smokeArgs = ['run', 'test:rag', '--', `--query=${query}`, `--locale=${locale}`];
const smokeExit = runStep('Retrieval smoke', 'npm', smokeArgs);

console.log('\n== RAG Setup Summary ==');
console.log(`Ingest: ${ingestExit === 0 ? 'PASS' : 'FAIL/NO-DATA'} (exit ${ingestExit})`);
console.log(`Retrieval: ${smokeExit === 0 ? 'PASS' : 'FAIL'} (exit ${smokeExit})`);

if (ingestExit === 0 && smokeExit === 0) {
  console.log('RAG health: PASS');
  process.exit(0);
}

if (smokeExit !== 0) {
  console.log('RAG health: FAIL (retrieval did not return context)');
  process.exit(1);
}

console.log('RAG health: PARTIAL (ingest had no new indexed docs, retrieval still works)');
process.exit(2);
