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
    heading: 'AgriNexus — контактна форма',
    name: 'Име',
    email: 'Имейл',
    company: 'Фирма',
    message: 'Съобщение',
    subjectPrefix: '[AgriNexus] Контакт',
  },
  en: {
    heading: 'AgriNexus — contact form',
    name: 'Name',
    email: 'Email',
    company: 'Company',
    message: 'Message',
    subjectPrefix: '[AgriNexus] Contact',
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
    heading: 'AgriNexus — интерес за регистрация',
    fullName: 'Име и фамилия',
    company: 'Фирма',
    businessEmail: 'Служебен имейл',
    phone: 'Телефон',
    marketFocus: 'Фокус на пазара',
    subscribeAlerts: 'Абонамент за известия',
    yes: 'да',
    no: 'не',
    subjectPrefix: '[AgriNexus] Регистрация',
  },
  en: {
    heading: 'AgriNexus — registration interest',
    fullName: 'Full name',
    company: 'Company',
    businessEmail: 'Business email',
    phone: 'Phone',
    marketFocus: 'Market focus',
    subscribeAlerts: 'Subscribe to alerts',
    yes: 'yes',
    no: 'no',
    subjectPrefix: '[AgriNexus] Registration',
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
