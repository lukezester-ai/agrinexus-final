/**
 * Export field-learning rows to JSONL for fine-tuning pipelines.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in environment.
 *
 * Usage:
 *   npx tsx scripts/export-field-learning-jsonl.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSupabaseServiceClient } from '../lib/infra/supabase-service.js';

type LearningRow = {
	field_id: string;
	input_text: string;
	target_json: Record<string, unknown>;
};

async function main() {
	const supabase = getSupabaseServiceClient();
	if (!supabase) {
		console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
		process.exit(1);
	}

	const { data, error } = await supabase
		.from('field_watch_learning_rows')
		.select('field_id, input_text, target_json')
		.order('field_id', { ascending: true });

	if (error) {
		console.error('Supabase error:', error.message);
		process.exit(1);
	}

	const rows = (data ?? []) as LearningRow[];
	const jsonl = rows
		.map(row =>
			JSON.stringify({
				messages: [
					{ role: 'system', content: 'You generate agronomy monitoring plans from structured field metadata.' },
					{ role: 'user', content: row.input_text },
					{ role: 'assistant', content: JSON.stringify(row.target_json) },
				],
			})
		)
		.join('\n');

	const outPath = resolve(process.cwd(), 'data', 'field-learning-ft.jsonl');
	writeFileSync(outPath, jsonl ? `${jsonl}\n` : '', 'utf-8');
	console.log(`Exported ${rows.length} rows -> ${outPath}`);
}

main().catch(err => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
