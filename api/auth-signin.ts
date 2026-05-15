import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthSigninPost } from '../lib/auth-credentials-handler.js';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method !== 'POST') {
		res.status(405).json({ ok: false, error: 'Method not allowed' });
		return;
	}

	const parsed = vercelJsonBody(req.body);
	if (parsed === null) {
		res.status(400).json({ ok: false, error: 'Invalid JSON body' });
		return;
	}

	const result = await handleAuthSigninPost(parsed, {
		clientIp: clientIpFromVercelRequest(req),
	});

	if (!result.ok) {
		res.status(result.status).json({
			ok: false,
			error: result.error,
			hint: result.hint,
			code: result.code,
		});
		return;
	}

	res.status(200).json({ ok: true, session: result.session });
}
