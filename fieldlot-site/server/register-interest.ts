import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { assertLeadFormAntiBot } from './bot-guard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export type LeadHandlerCtx = { clientIp?: string | null };

function normalizePhone(value: string): string {
	const digitsOnly = value.replace(/\D/g, '');
	if (!digitsOnly) return '';
	return `+${digitsOnly}`.slice(0, 16);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function inboxTo(): string {
	return (
		process.env.FIELDLOT_INBOX_EMAIL?.trim() ||
		process.env.MAIL_TO?.trim() ||
		process.env.CONTACT_TO_EMAIL?.trim() ||
		''
	);
}

function fromAddress(): string | null {
	const v =
		process.env.MAIL_FROM?.trim() ||
		process.env.RESEND_FROM?.trim() ||
		process.env.SMTP_FROM?.trim() ||
		'';
	return v || null;
}

async function sendViaResend(opts: {
	to: string;
	from: string;
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
}): Promise<'sent' | 'failed' | 'skipped'> {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) return 'skipped';

	const body: Record<string, unknown> = {
		from: opts.from,
		to: [opts.to],
		subject: opts.subject,
		html: opts.html,
		reply_to: opts.replyTo ? [opts.replyTo] : undefined,
	};
	if (opts.text?.trim()) body.text = opts.text.trim();

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const data = (await res.json().catch(() => ({}))) as { message?: string };
	if (!res.ok) {
		const detail = typeof data.message === 'string' ? data.message : res.statusText;
		throw new Error(detail || 'Resend API error');
	}
	return 'sent';
}

async function maybeAppendJsonl(record: Record<string, unknown>): Promise<void> {
	if (process.env.FIELDLOT_STORE_LEADS !== '1') return;
	const dir = join(process.cwd(), '.local');
	await mkdir(dir, { recursive: true });
	const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
	await appendFile(join(dir, 'fieldlot-leads.jsonl'), line, 'utf8');
}

function buildRegisterEmailHtml(input: {
	fullName: string;
	companyName: string;
	businessEmail: string;
	phone: string;
	marketFocus: string;
	subscribeAlerts: boolean;
}): string {
	const empty = '—';
	const yn = input.subscribeAlerts ? 'да' : 'не';
	return `
    <h2>Fieldlot — заявка за ранен достъп</h2>
    <p><strong>Име:</strong> ${escapeHtml(input.fullName)}</p>
    <p><strong>Фирма:</strong> ${escapeHtml(input.companyName)}</p>
    <p><strong>Имейл:</strong> ${escapeHtml(input.businessEmail)}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(input.phone || empty)}</p>
    <p><strong>Фокус:</strong> ${escapeHtml(input.marketFocus || empty)}</p>
    <p><strong>Известия:</strong> ${escapeHtml(yn)}</p>
  `.trim();
}

function buildRegisterEmailText(input: {
	fullName: string;
	companyName: string;
	businessEmail: string;
	phone: string;
	marketFocus: string;
	subscribeAlerts: boolean;
}): string {
	const empty = '—';
	const yn = input.subscribeAlerts ? 'да' : 'не';
	return [
		'Fieldlot — заявка за ранен достъп',
		'',
		`Име: ${input.fullName}`,
		`Фирма: ${input.companyName}`,
		`Имейл: ${input.businessEmail}`,
		`Телефон: ${input.phone || empty}`,
		`Фокус: ${input.marketFocus || empty}`,
		`Известия: ${yn}`,
	].join('\n');
}

export async function handleRegisterInterestPost(
	rawBody: unknown,
	ctx?: LeadHandlerCtx,
): Promise<
	| { ok: true; preview?: string; mailDelivery: 'sent' | 'skipped' }
	| { ok: false; status: number; error: string; hint?: string }
> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const b = rawBody as Record<string, unknown>;
	const anti = assertLeadFormAntiBot(b, { clientIp: ctx?.clientIp ?? null });
	if (!anti.ok) {
		return { ok: false, status: anti.status, error: anti.error, hint: anti.hint };
	}

	const rawFullName = typeof b.fullName === 'string' ? b.fullName.trim() : '';
	const companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
	const businessEmail = typeof b.businessEmail === 'string' ? b.businessEmail.trim() : '';
	const phone = typeof b.phone === 'string' ? normalizePhone(b.phone) : '';
	const marketFocus = typeof b.marketFocus === 'string' ? b.marketFocus.trim() : '';
	const subscribeAlerts = Boolean(b.subscribeAlerts);

	if (!businessEmail || !EMAIL_RE.test(businessEmail)) {
		return { ok: false, status: 400, error: 'Valid business email required' };
	}
	if (phone && !PHONE_RE.test(phone)) {
		return {
			ok: false,
			status: 400,
			error: 'Valid phone required',
			hint: 'Provide phone in E.164 format, e.g. +359881234567.',
		};
	}

	const derivedFullName =
		rawFullName.length >= 2
			? rawFullName
			: (businessEmail.includes('@') ? businessEmail.split('@')[0] : '') || 'User';
	const resolvedCompany = companyName || 'Не е посочено';
	const resolvedMarket = marketFocus || '—';

	const preview = `${derivedFullName} · ${resolvedCompany} · ${businessEmail} · ${resolvedMarket} · alerts:${subscribeAlerts ? 'yes' : 'no'} · ${phone || 'no phone'}`;

	await maybeAppendJsonl({
		type: 'fieldlot-register-interest',
		fullName: derivedFullName,
		companyName: resolvedCompany,
		businessEmail,
		phone,
		marketFocus: resolvedMarket === '—' ? '' : resolvedMarket,
		subscribeAlerts,
	});

	const to = inboxTo();
	const from = fromAddress();
	const html = buildRegisterEmailHtml({
		fullName: derivedFullName,
		companyName: resolvedCompany,
		businessEmail,
		phone,
		marketFocus: resolvedMarket,
		subscribeAlerts,
	});
	const text = buildRegisterEmailText({
		fullName: derivedFullName,
		companyName: resolvedCompany,
		businessEmail,
		phone,
		marketFocus: resolvedMarket,
		subscribeAlerts,
	});
	const subject = `[Fieldlot] Ранен достъп · ${derivedFullName}`;

	if (!to || !from) {
		return { ok: true, preview, mailDelivery: 'skipped' };
	}

	try {
		const sent = await sendViaResend({ to, from, subject, html, text, replyTo: businessEmail });
		return { ok: true, preview, mailDelivery: sent === 'sent' ? 'sent' : 'skipped' };
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Email delivery failed';
		return { ok: false, status: 502, error: 'Email delivery failed', hint: msg };
	}
}
