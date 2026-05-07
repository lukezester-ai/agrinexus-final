import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseServiceClient } from '../lib/infra/supabase-service.js';

type FieldPayload = {
	name: string;
	crop: string;
	areaDecares: number;
	geometry: unknown;
	notes?: string;
};

function sendJson(res: VercelResponse, status: number, payload: Record<string, unknown>) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function parseBody(raw: unknown): Record<string, unknown> | null {
	if (!raw) return null;
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return null;
		}
	}
	if (typeof raw === 'object') return raw as Record<string, unknown>;
	return null;
}

function asFieldPayload(body: Record<string, unknown>): FieldPayload | null {
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const crop = typeof body.crop === 'string' ? body.crop.trim() : '';
	const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
	const areaDecares =
		typeof body.areaDecares === 'number'
			? body.areaDecares
			: Number.parseFloat(String(body.areaDecares ?? ''));
	const geometry = body.geometry;

	if (!name || !crop || !Number.isFinite(areaDecares) || areaDecares <= 0 || !geometry) return null;
	return {
		name,
		crop,
		areaDecares,
		geometry,
		notes: notes || '',
	};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	const supabase = getSupabaseServiceClient();
	if (!supabase) {
		sendJson(res, 500, {
			ok: false,
			error: 'Supabase is not configured on server (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)',
		});
		return;
	}

	if (req.method === 'GET') {
		const { data, error } = await supabase
			.from('field_watch_fields')
			.select('id, created_at, name, crop, area_decares, geometry, notes')
			.order('created_at', { ascending: false })
			.limit(300);
		if (error) {
			sendJson(res, 500, {
				ok: false,
				error: error.message,
				hint: 'Run supabase-field-watch.sql in Supabase SQL Editor if table is missing.',
			});
			return;
		}
		sendJson(res, 200, { ok: true, fields: data ?? [] });
		return;
	}

	if (req.method !== 'POST') {
		sendJson(res, 405, { ok: false, error: 'Method not allowed' });
		return;
	}

	const body = parseBody(req.body);
	if (!body) {
		sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
		return;
	}
	const payload = asFieldPayload(body);
	if (!payload) {
		sendJson(res, 400, {
			ok: false,
			error: 'Missing required fields: name, crop, areaDecares, geometry',
		});
		return;
	}

	const { data, error } = await supabase
		.from('field_watch_fields')
		.insert({
			name: payload.name,
			crop: payload.crop,
			area_decares: payload.areaDecares,
			geometry: payload.geometry,
			notes: payload.notes ?? '',
		})
		.select('id, created_at')
		.single();

	if (error) {
		sendJson(res, 500, {
			ok: false,
			error: error.message,
			hint: 'Run supabase-field-watch.sql in Supabase SQL Editor if table is missing.',
		});
		return;
	}

	sendJson(res, 200, { ok: true, field: data });
}
