import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AGN_POLICY } from './lib/agrinexus-policy.js';
import { getChatMistral } from './lib/mistral-client.js';
import { fetchMarketSnapshotForLlm } from './lib/market-snapshot.js';
import { checkRateLimit, clientIpFromVercelRequest } from './lib/rate-limit.js';

function logJson(event: string, fields: Record<string, unknown>) {
	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			service: 'agrinexus-academy-tutor',
			event,
			...fields,
		}),
	);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const ip = clientIpFromVercelRequest(req);
	const max = Number(process.env.AGN_ACADEMY_RATE_LIMIT_PER_MIN ?? '30') || 30;
	if (!checkRateLimit(`academy:${ip}`, max, 60_000)) {
		logJson('rate_limited', { ip });
		return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
	}

	if (!process.env.MISTRAL_API_KEY) {
		return res.status(503).json({
			error: 'MISTRAL_API_KEY is not configured.',
		});
	}

	try {
		const body =
			typeof req.body === 'string' && req.body.length > 0
				? (JSON.parse(req.body) as Record<string, unknown>)
				: (req.body as Record<string, unknown> | undefined) ?? {};
		const message = typeof body.message === 'string' ? body.message.trim() : '';
		if (!message) {
			return res.status(400).json({ error: 'message is required' });
		}

		const t0 = Date.now();
		const snapshot = await fetchMarketSnapshotForLlm();
		const system = `${AGN_POLICY}

You are the **AgriNexus Academy Tutor** linked to the public Academy pages (learning paths, market literacy, risk).
- Teach concepts: how futures quotes relate to farm gate prices, basis, seasonality, reading a delayed ticker.
- Use the MARKET SNAPSHOT only as a didactic example; repeat that it is delayed Yahoo data, not trading advice.
- If asked for legal, medical, or site-specific account actions, decline and point to official channels.
- Keep answers concise (roughly 2–5 short paragraphs unless the user asks for depth).`;

		const llm = getChatMistral(process.env.MISTRAL_ACADEMY_TUTOR_MODEL?.trim());
		const response = await llm.invoke([
			new SystemMessage(`${system}\n\n${snapshot}`),
			new HumanMessage(message),
		]);
		const text = String(response.content ?? '').trim();
		logJson('academy_tutor_ok', { ms: Date.now() - t0, len: text.length });
		return res.status(200).json({
			ok: true,
			reply: text,
			source: 'academy-tutor',
		});
	} catch (e) {
		logJson('academy_tutor_error', { err: e instanceof Error ? e.message : String(e) });
		return res.status(500).json({ error: 'Academy tutor failed.' });
	}
}
