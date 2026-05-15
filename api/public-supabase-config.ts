import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePublicSupabaseConfigGet } from '../lib/public-supabase-config-handler.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method !== 'GET') {
		res.status(405).json({ ok: false, error: 'Method not allowed' });
		return;
	}

	const r = handlePublicSupabaseConfigGet();
	if (!r.ok) {
		res.status(r.status).json({ ok: false, error: r.error });
		return;
	}
	res.status(200).json({
		ok: true,
		supabaseUrl: r.supabaseUrl,
		supabaseAnonKey: r.supabaseAnonKey,
	});
}
