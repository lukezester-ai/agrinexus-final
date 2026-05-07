/**
 * Machine-readable RAG setup check for CI/monitoring.
 * Emits a single JSON object to stdout.
 *
 * Usage:
 *   npm run rag:setup:json
 *   npm run rag:setup:json -- --query="..." --locale=bg --max-docs=50
 */
import { spawnSync } from 'node:child_process';

type StepResult = {
  exitCode: number;
};

type RagSetupJson = {
  ok: boolean;
  health: 'PASS' | 'PARTIAL' | 'FAIL';
  ingest: StepResult;
  retrieval: StepResult;
  query: string;
  locale: 'bg' | 'en';
  maxDocs?: number;
  timestamp: string;
};

function readArg(name: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
}

function readPositiveIntArg(name: string): number | null {
  const raw = readArg(name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function runStep(command: string, args: string[]): number {
  const r = spawnSync(command, args, {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return typeof r.status === 'number' ? r.status : 1;
}

const query =
  readArg('query') || 'Какви документи и срокове трябва да следя за субсидии при зърнопроизводство?';
const locale: 'bg' | 'en' = readArg('locale') === 'en' ? 'en' : 'bg';
const maxDocs = readPositiveIntArg('max-docs');

const ingestArgs = ['run', 'ingest:rag', '--'];
if (maxDocs !== null) ingestArgs.push(`--max-docs=${maxDocs}`);
const ingestExit = runStep('npm', ingestArgs);

const smokeArgs = ['run', 'test:rag', '--', `--query=${query}`, `--locale=${locale}`];
const smokeExit = runStep('npm', smokeArgs);

let health: RagSetupJson['health'] = 'FAIL';
let ok = false;
if (ingestExit === 0 && smokeExit === 0) {
  health = 'PASS';
  ok = true;
} else if (smokeExit === 0) {
  health = 'PARTIAL';
}

const payload: RagSetupJson = {
  ok,
  health,
  ingest: { exitCode: ingestExit },
  retrieval: { exitCode: smokeExit },
  query,
  locale,
  ...(maxDocs !== null ? { maxDocs } : {}),
  timestamp: new Date().toISOString(),
};

process.stdout.write(`${JSON.stringify(payload)}\n`);

if (health === 'PASS') process.exit(0);
if (health === 'PARTIAL') process.exit(2);
process.exit(1);
