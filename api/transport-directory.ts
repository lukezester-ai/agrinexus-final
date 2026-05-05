import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTransportDirectoryGet } from '../lib/transport-directory-handler.js';

function sendJson(res: VercelResponse, status: number, payload: unknown) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

/** Production: GET returns curated seed (+ empty server file). Registration stays in the browser until a DB is connected. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}
	if (req.method === 'GET') {
		const r = await handleTransportDirectoryGet();
		sendJson(res, 200, r);
		return;
	}
	sendJson(res, 405, { error: 'Method not allowed' });
}
