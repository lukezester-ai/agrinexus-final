import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleDocDiscoverySearchRequest } from '../lib/doc-discovery-search-handler.js';

function sendJson(res: VercelResponse, status: number, payload: Record<string, unknown>) {
	res.status(status);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function queryParamsFromVercel(req: VercelRequest): URLSearchParams {
	const p = new URLSearchParams();
	const raw = req.query;
	if (raw && typeof raw === 'object') {
		for (const [key, val] of Object.entries(raw)) {
			if (typeof val === 'string') p.set(key, val);
			else if (Array.isArray(val) && typeof val[0] === 'string') p.set(key, val[0]);
		}
	}
	const fallbackUrl = typeof req.url === 'string' ? req.url : '';
	try {
		const url = new URL(fallbackUrl, 'http://localhost');
		for (const [k, v] of url.searchParams.entries()) {
			p.set(k, v);
		}
	} catch {
		/* ignore */
	}
	return p;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}

		const auth =
			(typeof req.headers.authorization === 'string' && req.headers.authorization) ||
			(typeof req.headers.Authorization === 'string' && req.headers.Authorization) ||
			undefined;

		const r = await handleDocDiscoverySearchRequest({
			method: req.method || 'GET',
			queryParams: queryParamsFromVercel(req),
			authHeader: auth,
		});
		sendJson(res, r.status, r.body);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Internal error';
		sendJson(res, 500, { ok: false, error: msg });
	}
}
