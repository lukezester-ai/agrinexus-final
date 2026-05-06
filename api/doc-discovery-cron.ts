import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleDocDiscoveryCronRequest } from '../lib/doc-discovery-cron-handler.js';

function sendJson(res: VercelResponse, status: number, payload: Record<string, unknown>) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}

		const authHeader =
			(typeof req.headers.authorization === 'string' && req.headers.authorization) ||
			(typeof req.headers.Authorization === 'string' && req.headers.Authorization) ||
			undefined;

		const r = await handleDocDiscoveryCronRequest({
			method: req.method || 'GET',
			authHeader,
		});
		sendJson(res, r.status, r.body);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Internal error';
		sendJson(res, 500, { ok: false, error: msg });
	}
}
