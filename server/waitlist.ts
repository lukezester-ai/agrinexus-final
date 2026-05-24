const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inboxTo(): string {
	return (
		process.env.FURROW_INBOX_EMAIL?.trim() ||
		process.env.FIELDLOT_INBOX_EMAIL?.trim() ||
		process.env.MAIL_TO?.trim() ||
		''
	);
}

function fromAddress(): string | null {
	const v = process.env.RESEND_FROM?.trim() || process.env.MAIL_FROM?.trim() || '';
	return v || null;
}

async function sendViaResend(opts: {
	to: string | string[];
	from: string;
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
}): Promise<'sent' | 'skipped'> {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) return 'skipped';

	const toList = Array.isArray(opts.to) ? opts.to : [opts.to];

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: opts.from,
			to: toList,
			subject: opts.subject,
			html: opts.html,
			text: opts.text,
			reply_to: opts.replyTo ? [opts.replyTo] : undefined,
		}),
	});

	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { message?: string };
		throw new Error(typeof data.message === 'string' ? data.message : res.statusText);
	}
	return 'sent';
}

function welcomeCopy(lang: 'en' | 'bg', fullName: string): { subject: string; html: string; text: string } {
	if (lang === 'bg') {
		return {
			subject: 'Furrow Markets — вие сте в списъка за ранен достъп',
			text: `Здравейте, ${fullName}!\n\nБлагодарим за регистрацията в Furrow Markets. Ще се свържем преди старт (лято 2026).\n\n— Furrow Markets`,
			html: `<p>Здравейте, <strong>${fullName}</strong>!</p><p>Благодарим за регистрацията в <strong>Furrow Markets</strong>. Ще пишем преди старт (лято 2026).</p><p style="color:#64748b;font-size:14px;">Това писмо не е инвестиционен съвет.</p>`,
		};
	}
	return {
		subject: 'Furrow Markets — you are on the waitlist',
		text: `Hi ${fullName},\n\nThanks for registering with Furrow Markets. We will be in touch before launch (summer 2026).\n\n— Furrow Markets`,
		html: `<p>Hi <strong>${fullName}</strong>,</p><p>Thanks for registering with <strong>Furrow Markets</strong>. We will be in touch before launch (summer 2026).</p><p style="color:#64748b;font-size:14px;">This is not investment advice.</p>`,
	};
}

export async function submitFurrowWaitlist(input: {
	fullName: string;
	email: string;
	interest?: string;
	lang?: 'en' | 'bg' | 'ru';
	source?: string;
}): Promise<
	| { ok: true; mailDelivery: 'sent'; welcomeSent: boolean }
	| { ok: false; error: string }
> {
	const email = input.email.trim().toLowerCase();
	const fullName = (input.fullName.trim() || email.split('@')[0] || 'Subscriber').slice(0, 120);
	const interest = (input.interest?.trim() || 'all').slice(0, 64);
	const lang = input.lang === 'bg' || input.lang === 'ru' ? 'bg' : 'en';
	const source = (input.source?.trim() || 'website').slice(0, 64);

	if (!EMAIL_RE.test(email)) {
		return { ok: false, error: 'Invalid email' };
	}

	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) {
		return {
			ok: false,
			error:
				'RESEND_API_KEY is not set — registrations cannot be delivered. Configure Resend or use another signup channel.',
		};
	}

	const to = inboxTo();
	const from = fromAddress();
	if (!to || !from) {
		return {
			ok: false,
			error:
				'Waitlist email is misconfigured: set FURROW_INBOX_EMAIL (or MAIL_TO) and RESEND_FROM together with RESEND_API_KEY.',
		};
	}

	const subject = `[Furrow] Registration · ${fullName}`;
	const text = [
		`Furrow waitlist registration (${source})`,
		`Name: ${fullName}`,
		`Email: ${email}`,
		`Interest: ${interest}`,
		`Lang: ${lang}`,
	].join('\n');
	const html = `<p><strong>Furrow registration</strong> (${source})</p><p>Name: ${fullName}</p><p>Email: ${email}</p><p>Interest: ${interest}</p><p>Lang: ${lang}</p>`;

	try {
		const sent = await sendViaResend({ to, from, subject, html, text, replyTo: email });
		if (sent !== 'sent') {
			return {
				ok: false,
				error: 'Email was not sent (check RESEND_API_KEY and sender/domain verification).',
			};
		}
		let welcomeSent = false;
		if (process.env.FURROW_WELCOME_EMAIL !== '0') {
			const w = welcomeCopy(lang, fullName);
			try {
				await sendViaResend({
					to: email,
					from,
					subject: w.subject,
					html: w.html,
					text: w.text,
					replyTo: to,
				});
				welcomeSent = true;
			} catch {
				/* admin notified; welcome optional */
			}
		}
		return { ok: true, mailDelivery: 'sent', welcomeSent };
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Email failed';
		return { ok: false, error: msg };
	}
}
