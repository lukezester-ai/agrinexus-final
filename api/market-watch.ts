import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleMarketWatchGet } from '../lib/market-watch-api.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	try {
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}

		if (req.method !== 'GET') {
			res.status(405).json({ error: 'Method not allowed' });
			return;
		}

		const result = await handleMarketWatchGet();
		res.status(200).json(result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unexpected server error';
		res.status(500).json({
			ok: false,
			mode: 'error',
			quotes: [],
			fetchedAt: new Date().toISOString(),
			source: null,
			error: msg,
			watch: null,
		});
	}
}
