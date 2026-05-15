import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthStatusGet } from '../lib/auth-status-handler.js';

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

	res.status(200).json(handleAuthStatusGet());
}
