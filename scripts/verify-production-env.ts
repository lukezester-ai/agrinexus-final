/**
 * Проверка на ключови променливи за продукция (без извеждане на стойности).
 *
 * По подразбиране: изход 0 (информативно).
 * Строг режим: `tsx scripts/verify-production-env.ts --strict` или PRODUCTION_ENV_STRICT=1 —
 * изход 1 при липса на LLM за чат (Mistral / OpenAI / Ollama).
 *
 * За Vercel: добави стъпка след build, напр.
 *   npm run build && npx tsx scripts/verify-production-env.ts --strict
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { isChatLlmConfigured } from '../lib/llm-env';

function mergeDotEnvWithoutBom(): void {
	const envPath = path.join(process.cwd(), '.env');
	if (!fs.existsSync(envPath)) return;
	try {
		const text = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
		const parsed = dotenv.parse(text);
		for (const key of [
			'OPENAI_API_KEY',
			'MISTRAL_API_KEY',
			'OLLAMA_BASE_URL',
			'OLLAMA_MODEL',
			'VITE_SUPABASE_URL',
			'VITE_SUPABASE_ANON_KEY',
			'SUPABASE_URL',
			'SUPABASE_SERVICE_ROLE_KEY',
		]) {
			const v = parsed[key];
			if (typeof v === 'string' && v.trim() && !process.env[key]?.trim()) {
				process.env[key] = v.trim();
			}
		}
	} catch {
		/* ignore */
	}
}

mergeDotEnvWithoutBom();

function t(ok: boolean): string {
	return ok ? 'OK' : 'MISSING';
}

function trim(s: string | undefined): string {
	return typeof s === 'string' ? s.trim() : '';
}

const strict =
	process.argv.includes('--strict') ||
	process.env.PRODUCTION_ENV_STRICT === '1' ||
	process.env.VERIFY_PRODUCTION_ENV_STRICT === '1';

const llm = isChatLlmConfigured();
const viteUrl = trim(process.env.VITE_SUPABASE_URL);
const viteAnon = trim(process.env.VITE_SUPABASE_ANON_KEY);
const svcUrl = trim(process.env.SUPABASE_URL);
const svcKey = trim(process.env.SUPABASE_SERVICE_ROLE_KEY);
const siteUrl = trim(process.env.VITE_SITE_URL);

console.log('— Production-oriented env check (values are never printed) —');
console.log(`  LLM for chat (Mistral / OpenAI / Ollama): ${t(llm)}`);
console.log(`  VITE_SUPABASE_URL: ${t(Boolean(viteUrl))}`);
console.log(`  VITE_SUPABASE_ANON_KEY: ${t(Boolean(viteAnon))}`);
console.log(`  SUPABASE_URL (service): ${t(Boolean(svcUrl))}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${t(Boolean(svcKey))}`);
console.log(`  VITE_SITE_URL (canonical links): ${t(Boolean(siteUrl))}`);

if (!viteUrl || !viteAnon) {
	console.warn('  (hint) Without VITE_SUPABASE_* the signed-in / cloud sync paths stay disabled in the client bundle.');
}
if (!svcUrl || !svcKey) {
	console.warn('  (hint) Without SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY server routes that need admin client may fail.');
}

if (strict && !llm) {
	console.error('Strict mode: configure at least one of MISTRAL_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL + OLLAMA_MODEL.');
	process.exit(1);
}

process.exit(0);
