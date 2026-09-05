import type { VercelRequest, VercelResponse } from './lib/vercel-types.js';

/** Public client config (no secrets). */
export default function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Cache-Control', 'public, max-age=60');
	res.setHeader('Access-Control-Allow-Origin', '*');

	if (req.method === 'OPTIONS') {
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.status(204).end();
		return;
	}

	if (req.method !== 'GET') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const mailchimpUrl = (process.env.FURROW_MAILCHIMP_URL || '').trim();
	const mailchimpHidden = (process.env.FURROW_MAILCHIMP_HIDDEN || '').trim();
	const resendConfigured = Boolean(
		process.env.RESEND_API_KEY?.trim() &&
			process.env.RESEND_FROM?.trim() &&
			(process.env.FURROW_INBOX_EMAIL?.trim() || process.env.MAIL_TO?.trim()),
	);

	res.status(200).json({
		mailchimpConfigured: Boolean(mailchimpUrl && mailchimpHidden),
		mailchimpUrl: mailchimpUrl || null,
		mailchimpHidden: mailchimpHidden || null,
		waitlistResendConfigured: resendConfigured,
		waitlistApi: true,
		signalsApi: true,
	});
}
