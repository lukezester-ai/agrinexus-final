import { getSupabaseServiceClient } from './infra/supabase-service.js';

type LearningLoopResult =
	| { ok: true; scanned: number; upserted: number }
	| { ok: false; error: string };

type FieldRow = {
	id: string;
	name: string;
	crop: string;
	area_decares: number;
	notes: string | null;
	created_at: string;
};

function areaBucket(areaDecares: number): 'small' | 'medium' | 'large' {
	if (areaDecares < 25) return 'small';
	if (areaDecares < 120) return 'medium';
	return 'large';
}

function suggestMonitoringFrequencyDays(areaDecares: number, crop: string): number {
	const c = crop.toLowerCase();
	const isSensitive = c.includes('tomato') || c.includes('sunflower') || c.includes('corn');
	const bucket = areaBucket(areaDecares);
	if (bucket === 'small') return isSensitive ? 3 : 5;
	if (bucket === 'medium') return isSensitive ? 4 : 6;
	return isSensitive ? 5 : 7;
}

function toLearningRow(field: FieldRow) {
	const bucket = areaBucket(field.area_decares);
	const freq = suggestMonitoringFrequencyDays(field.area_decares, field.crop);
	const cleanNotes = (field.notes || '').trim();
	const inputText =
		`field_name=${field.name}; crop=${field.crop}; area_decares=${field.area_decares.toFixed(2)}; ` +
		`notes=${cleanNotes || 'none'}`;
	const target = {
		size_bucket: bucket,
		monitoring_frequency_days: freq,
		recommended_layers: ['true-color', 'ndvi'],
	};
	return {
		field_id: field.id,
		input_text: inputText,
		target_json: target,
	};
}

export async function runFieldLearningLoop(limit = 500): Promise<LearningLoopResult> {
	const supabase = getSupabaseServiceClient();
	if (!supabase) {
		return {
			ok: false,
			error: 'Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)',
		};
	}

	const { data: fields, error: fetchErr } = await supabase
		.from('field_watch_fields')
		.select('id, name, crop, area_decares, notes, created_at')
		.order('created_at', { ascending: false })
		.limit(limit);
	if (fetchErr) return { ok: false, error: fetchErr.message };

	const rows = (fields ?? []).map(x => toLearningRow(x as FieldRow));
	if (!rows.length) return { ok: true, scanned: 0, upserted: 0 };

	const { error: upsertErr } = await supabase
		.from('field_watch_learning_rows')
		.upsert(rows, { onConflict: 'field_id' });
	if (upsertErr) return { ok: false, error: upsertErr.message };

	return { ok: true, scanned: rows.length, upserted: rows.length };
}
