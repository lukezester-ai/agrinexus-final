import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
	handleOperationsHubGet,
	handleOperationsHubPost,
} from '../lib/operations-hub-handler.js';

function sendJson(res: VercelResponse, status: number, payload: unknown) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

/** Single shared snapshot for demo/dev — reconciles by `updatedAt`. Serverless FS may be read-only (push then fails gracefully on client). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}
	if (req.method === 'GET') {
		const r = await handleOperationsHubGet();
		sendJson(res, 200, r);
		return;
	}
	if (req.method === 'POST') {
		let body: unknown = req.body;
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body) as unknown;
			} catch {
				sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
				return;
			}
		}
		if (body === undefined || body === null) {
			sendJson(res, 400, { ok: false, error: 'Missing body' });
			return;
		}
		const result = await handleOperationsHubPost(body);
		if (result.ok === false) {
			sendJson(res, result.status, { ok: false, error: result.error });
			return;
		}
		if ('conflict' in result && result.conflict === true) {
			sendJson(res, 200, { ok: true, conflict: true, state: result.state });
			return;
		}
		sendJson(res, 200, { ok: true, state: result.state });
		return;
	}
	sendJson(res, 405, { error: 'Method not allowed' });
}
