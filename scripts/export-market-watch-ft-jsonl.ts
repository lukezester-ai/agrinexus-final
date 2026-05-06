/**
 * Експорт на примери за Mistral fine-tuning (пазарни инсайти).
 *
 * Употреба:
 *   npx tsx scripts/export-market-watch-ft-jsonl.ts
 *   npx tsx scripts/export-market-watch-ft-jsonl.ts --out=.local/market-watch-ft.jsonl
 *   npx tsx scripts/export-market-watch-ft-jsonl.ts --limit=200
 *   npx tsx scripts/export-market-watch-ft-jsonl.ts --from-singleton
 *
 * Изисква .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { getSupabaseServiceClient } from '../lib/infra/supabase-service.js';
import { marketWatchPayloadToMistralFtJsonLine } from '../lib/market-watch-ft-export.js';
import { MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT } from '../lib/market-watch-insights-prompt.js';
import { loadMarketWatchState } from '../lib/market-watch-state.js';

function parseArgs(argv: string[]): { out?: string; limit?: number; fromSingleton: boolean } {
	let out: string | undefined;
	let limit: number | undefined;
	let fromSingleton = false;
	for (const a of argv) {
		if (a === '--from-singleton') fromSingleton = true;
		else if (a.startsWith('--out=')) out = a.slice('--out='.length).trim();
		else if (a.startsWith('--limit=')) {
			const n = Number(a.slice('--limit='.length));
			if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
		}
	}
	return { out, limit, fromSingleton };
}

async function linesFromTable(limit?: number): Promise<string[]> {
	const client = getSupabaseServiceClient();
	if (!client) {
		console.error('Липсват SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env');
		process.exit(1);
	}

	let q = client
		.from('market_watch_ft_rows')
		.select('input_compact,output_json')
		.order('created_at', { ascending: true });

	if (limit != null) q = q.limit(limit);

	const { data, error } = await q;
	if (error) {
		console.error('Supabase:', error.message);
		console.error('Изпълни ли supabase-market-watch-ft-rows.sql в проекта?');
		process.exit(1);
	}

	const rows = data ?? [];
	const lines: string[] = [];
	for (const row of rows) {
		const ic = row.input_compact;
		const oj = row.output_json;
		if (ic == null || oj == null) continue;
		const userContent = typeof ic === 'string' ? ic : JSON.stringify(ic);
		const assistantContent = typeof oj === 'string' ? oj : JSON.stringify(oj);
		lines.push(
			JSON.stringify({
				messages: [
					{ role: 'system', content: MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT },
					{ role: 'user', content: userContent },
					{ role: 'assistant', content: assistantContent },
				],
			}),
		);
	}
	return lines;
}

async function main() {
	const { out, limit, fromSingleton } = parseArgs(process.argv.slice(2));

	let lines: string[];
	if (fromSingleton) {
		const state = await loadMarketWatchState();
		const one = marketWatchPayloadToMistralFtJsonLine(state);
		if (!one) {
			console.error('Няма lastInsights в market_watch_state — отвори /api/market-watch или включи LLM инсайти първо.');
			process.exit(1);
		}
		lines = [one];
	} else {
		lines = await linesFromTable(limit);
		if (lines.length === 0) {
			console.error('Няма редове в market_watch_ft_rows. Задай MARKET_WATCH_FT_LOG=1 и изчакай инсайти, или ползвай --from-singleton.');
			process.exit(1);
		}
	}

	const body = `${lines.join('\n')}\n`;
	if (out) {
		const dir = path.dirname(path.resolve(out));
		mkdirSync(dir, { recursive: true });
		writeFileSync(out, body, 'utf8');
		console.error(`Написано ${lines.length} реда → ${path.resolve(out)}`);
	} else {
		process.stdout.write(body);
	}
}

void main();
