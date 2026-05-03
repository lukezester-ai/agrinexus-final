import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPlatformPayload } from '../lib/infra/platform-layers';

function sendJson(res: VercelResponse, status: number, payload: unknown) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

export default function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}
	if (req.method !== 'GET') {
		sendJson(res, 405, { error: 'Method not allowed' });
		return;
	}
	sendJson(res, 200, getPlatformPayload());
}
