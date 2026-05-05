import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVisitPost, handleVisitStatsGet } from '../lib/visit-stats-handler.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

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

		if (req.method === 'GET') {
			const r = await handleVisitStatsGet(authHeader);
			if (!r.ok) {
				sendJson(res, r.status, { ok: false, error: r.error });
				return;
			}
			sendJson(res, 200, {
				ok: true,
				totalSessions: r.totalSessions,
				uniqueVisitors: r.uniqueVisitors,
				updatedAt: r.updatedAt,
				storage: r.storage,
			});
			return;
		}

		if (req.method === 'POST') {
			const parsed = vercelJsonBody(req.body);
			if (parsed === null) {
				sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
				return;
			}
			const r = await handleVisitPost(parsed);
			if (!r.ok) {
				sendJson(res, r.status, { ok: false, error: r.error });
				return;
			}
			sendJson(res, 200, {
				ok: true,
				totalSessions: r.totalSessions,
				uniqueVisitors: r.uniqueVisitors,
				storage: r.storage,
			});
			return;
		}

		sendJson(res, 405, { ok: false, error: 'Method not allowed' });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Internal error';
		sendJson(res, 500, { ok: false, error: msg });
	}
}
