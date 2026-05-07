import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runFieldLearningLoop } from '../lib/field-learning-loop.js';

function sendJson(res: VercelResponse, status: number, payload: Record<string, unknown>) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function bearerFromHeader(authHeader?: string): string | null {
	if (!authHeader) return null;
	const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
	return m?.[1]?.trim() || null;
}

function isAuthorized(authHeader?: string): boolean {
	const provided = bearerFromHeader(authHeader);
	if (!provided) return false;
	const allowed = [process.env.FIELD_LEARNING_CRON_SECRET?.trim(), process.env.CRON_SECRET?.trim()].filter(
		Boolean
	) as string[];
	if (!allowed.length) return false;
	return allowed.includes(provided);
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

		if (!isAuthorized(authHeader)) {
			sendJson(res, 401, {
				ok: false,
				error: 'Unauthorized',
				hint: 'Send Authorization: Bearer <FIELD_LEARNING_CRON_SECRET or CRON_SECRET>',
			});
			return;
		}

		const limitRaw = Number.parseInt(String(req.query?.limit ?? '500'), 10);
		const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 10), 5000) : 500;
		const result = await runFieldLearningLoop(limit);
		if (!result.ok) {
			sendJson(res, 500, { ok: false, error: result.error });
			return;
		}
		sendJson(res, 200, result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Internal error';
		sendJson(res, 500, { ok: false, error: msg });
	}
}
