import nodemailer from 'nodemailer';

export type MailLocale = 'bg' | 'en';

export type MailOutcome =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'not_configured' }
  | { status: 'failed'; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseMailLocale(value: unknown): MailLocale {
  return value === 'bg' ? 'bg' : 'en';
}

function inboxTo(): string {
  return (
    process.env.MAIL_TO?.trim() ||
    process.env.CONTACT_TO_EMAIL?.trim() ||
    process.env.AGRI_INBOX_EMAIL?.trim() ||
    'info@agrinexus.eu'
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
}): Promise<MailOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { status: 'skipped', reason: 'not_configured' };

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

  const data = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
  if (!res.ok) {
    const detail = typeof data.message === 'string' ? data.message : res.statusText;
    return { status: 'failed', error: detail || 'Resend API error' };
  }
  return { status: 'sent' };
}

async function sendViaSmtp(opts: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<MailOutcome> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host) return { status: 'skipped', reason: 'not_configured' };

  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === '1',
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text?.trim() || undefined,
      replyTo: opts.replyTo,
    });
    return { status: 'sent' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'SMTP send failed';
    return { status: 'failed', error: msg };
  }
}

/** Resend if RESEND_API_KEY set; else SMTP if SMTP_HOST set; else skipped. */
export async function sendInboundNotification(opts: {
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<MailOutcome> {
  const to = inboxTo();
  const from = fromAddress();
  if (!from) {
    return { status: 'skipped', reason: 'not_configured' };
  }

  const payload = { ...opts, to, from };

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(payload);
  }

  if (process.env.SMTP_HOST?.trim()) {
    return sendViaSmtp(payload);
  }

  return { status: 'skipped', reason: 'not_configured' };
}

const contactStrings = {
  bg: {
    heading: 'SIMA — контактна форма',
    name: 'Име',
    email: 'Имейл',
    company: 'Фирма',
    message: 'Съобщение',
    subjectPrefix: '[SIMA] Контакт',
  },
  en: {
    heading: 'SIMA — contact form',
    name: 'Name',
    email: 'Email',
    company: 'Company',
    message: 'Message',
    subjectPrefix: '[SIMA] Contact',
  },
} as const;

export function buildContactEmailHtml(
  input: {
    name: string;
    email: string;
    company: string;
    message: string;
  },
  locale: MailLocale = 'en'
): string {
  const t = contactStrings[locale];
  const empty = '—';
  return `
    <h2>${t.heading}</h2>
    <p><strong>${t.name}:</strong> ${escapeHtml(input.name || empty)}</p>
    <p><strong>${t.email}:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>${t.company}:</strong> ${escapeHtml(input.company || empty)}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(input.message)}</pre>
  `.trim();
}

export function buildContactEmailText(
  input: {
    name: string;
    email: string;
    company: string;
    message: string;
  },
  locale: MailLocale = 'en'
): string {
  const t = contactStrings[locale];
  const empty = '—';
  return [
    t.heading,
    '',
    `${t.name}: ${input.name || empty}`,
    `${t.email}: ${input.email}`,
    `${t.company}: ${input.company || empty}`,
    '',
    '---',
    '',
    input.message,
  ].join('\n');
}

export function contactNotificationSubject(nameOrEmail: string, locale: MailLocale = 'en'): string {
  const t = contactStrings[locale];
  return `${t.subjectPrefix} · ${nameOrEmail}`;
}

const registerStrings = {
  bg: {
    heading: 'SIMA — интерес за регистрация',
    fullName: 'Име и фамилия',
    company: 'Фирма',
    businessEmail: 'Служебен имейл',
    phone: 'Телефон',
    marketFocus: 'Фокус на пазара',
    subscribeAlerts: 'Абонамент за известия',
    yes: 'да',
    no: 'не',
    subjectPrefix: '[SIMA] Регистрация',
  },
  en: {
    heading: 'SIMA — registration interest',
    fullName: 'Full name',
    company: 'Company',
    businessEmail: 'Business email',
    phone: 'Phone',
    marketFocus: 'Market focus',
    subscribeAlerts: 'Subscribe to alerts',
    yes: 'yes',
    no: 'no',
    subjectPrefix: '[SIMA] Registration',
  },
} as const;

export function buildRegisterEmailHtml(
  input: {
    fullName: string;
    companyName: string;
    businessEmail: string;
    phone: string;
    marketFocus: string;
    subscribeAlerts: boolean;
  },
  locale: MailLocale = 'en'
): string {
  const t = registerStrings[locale];
  const empty = '—';
  const yn = input.subscribeAlerts ? t.yes : t.no;
  return `
    <h2>${t.heading}</h2>
    <p><strong>${t.fullName}:</strong> ${escapeHtml(input.fullName)}</p>
    <p><strong>${t.company}:</strong> ${escapeHtml(input.companyName)}</p>
    <p><strong>${t.businessEmail}:</strong> ${escapeHtml(input.businessEmail)}</p>
    <p><strong>${t.phone}:</strong> ${escapeHtml(input.phone || empty)}</p>
    <p><strong>${t.marketFocus}:</strong> ${escapeHtml(input.marketFocus || empty)}</p>
    <p><strong>${t.subscribeAlerts}:</strong> ${escapeHtml(yn)}</p>
  `.trim();
}

export function buildRegisterEmailText(
  input: {
    fullName: string;
    companyName: string;
    businessEmail: string;
    phone: string;
    marketFocus: string;
    subscribeAlerts: boolean;
  },
  locale: MailLocale = 'en'
): string {
  const t = registerStrings[locale];
  const empty = '—';
  const yn = input.subscribeAlerts ? t.yes : t.no;
  return [
    t.heading,
    '',
    `${t.fullName}: ${input.fullName}`,
    `${t.company}: ${input.companyName}`,
    `${t.businessEmail}: ${input.businessEmail}`,
    `${t.phone}: ${input.phone || empty}`,
    `${t.marketFocus}: ${input.marketFocus || empty}`,
    `${t.subscribeAlerts}: ${yn}`,
  ].join('\n');
}

export function registerNotificationSubject(displayLabel: string, locale: MailLocale = 'en'): string {
  const t = registerStrings[locale];
  return `${t.subjectPrefix} · ${displayLabel}`;
}

export type FieldlotListingEmailInput = {
	id: string;
	created_at: string;
	role: string;
	title: string;
	body: string;
	full_name: string;
	company_name: string;
	business_email: string;
	phone: string;
	subscribe_alerts: boolean;
	/** Supabase `auth.users.id` — за поддръжка/одит */
	user_id?: string | null;
};

export function fieldlotListingNotificationSubject(title: string): string {
  const short = title.length > 80 ? `${title.slice(0, 77)}…` : title;
  return `[Fieldlot] Нова обява · ${short}`;
}

export function buildFieldlotListingEmailHtml(input: FieldlotListingEmailInput): string {
	const yn = input.subscribe_alerts ? 'да' : 'не';
	const uid = input.user_id ? escapeHtml(input.user_id) : '—';
	return `
    <h2>Fieldlot — нова публикувана обява</h2>
    <p><strong>ID:</strong> ${escapeHtml(input.id)}</p>
    <p><strong>Дата:</strong> ${escapeHtml(input.created_at)}</p>
    <p><strong>Акаунт (user_id):</strong> ${uid}</p>
    <p><strong>Роля:</strong> ${escapeHtml(input.role)}</p>
    <p><strong>Заглавие:</strong> ${escapeHtml(input.title)}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(input.body)}</pre>
    <hr />
    <p><strong>Име:</strong> ${escapeHtml(input.full_name)}</p>
    <p><strong>Фирма/стопанство:</strong> ${escapeHtml(input.company_name || '—')}</p>
    <p><strong>Имейл:</strong> ${escapeHtml(input.business_email)}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(input.phone || '—')}</p>
    <p><strong>Известия Fieldlot:</strong> ${escapeHtml(yn)}</p>
  `.trim();
}

export function buildFieldlotListingEmailText(input: FieldlotListingEmailInput): string {
	const yn = input.subscribe_alerts ? 'да' : 'не';
	return [
		'Fieldlot — нова публикувана обява',
		'',
		`ID: ${input.id}`,
		`Дата: ${input.created_at}`,
		`Акаунт (user_id): ${input.user_id || '—'}`,
		`Роля: ${input.role}`,
    `Заглавие: ${input.title}`,
    '',
    'Описание:',
    input.body,
    '',
    `Име: ${input.full_name}`,
    `Фирма: ${input.company_name || '—'}`,
    `Имейл: ${input.business_email}`,
    `Телефон: ${input.phone || '—'}`,
    `Известия: ${yn}`,
  ].join('\n');
}
