import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { handleFieldlotListingsGet, handleFieldlotListingsPost } from '../lib/fieldlot-listings-handler.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method === 'GET') {
		const r = await handleFieldlotListingsGet();
		if (!r.ok) {
			res.status(r.status).json({ ok: false, error: r.error });
			return;
		}
		res.status(200).json({ ok: true, listings: r.listings, storage: r.storage });
		return;
	}

	if (req.method === 'POST') {
		const parsed = vercelJsonBody(req.body);
		if (parsed === null) {
			res.status(400).json({ ok: false, error: 'Invalid JSON body' });
			return;
		}
		const result = await handleFieldlotListingsPost(parsed, {
			clientIp: clientIpFromVercelRequest(req),
		});
		if (!result.ok) {
			res.status(result.status).json({ ok: false, error: result.error, hint: result.hint });
			return;
		}
		res.status(200).json({
			ok: true,
			listing: result.listing,
			mailDelivery: result.mailDelivery,
		});
		return;
	}

	res.status(405).json({ ok: false, error: 'Method not allowed' });
}
