import nodemailer from 'nodemailer';

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
  replyTo?: string;
}): Promise<MailOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { status: 'skipped', reason: 'not_configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo ? [opts.replyTo] : undefined,
    }),
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
  replyTo?: string;
}): Promise<MailOutcome> {
  const to = inboxTo();
  const from = fromAddress();
  if (!from) {
    return { status: 'skipped', reason: 'not_configured' };
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend({ ...opts, to, from });
  }

  if (process.env.SMTP_HOST?.trim()) {
    return sendViaSmtp({ ...opts, to, from });
  }

  return { status: 'skipped', reason: 'not_configured' };
}

export function buildContactEmailHtml(input: {
  name: string;
  email: string;
  company: string;
  message: string;
}): string {
  return `
    <h2>AgriNexus — contact form</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name || '—')}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(input.company || '—')}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(input.message)}</pre>
  `.trim();
}

export function buildRegisterEmailHtml(input: {
  fullName: string;
  companyName: string;
  businessEmail: string;
  phone: string;
  marketFocus: string;
  subscribeAlerts: boolean;
}): string {
  return `
    <h2>AgriNexus — registration interest</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.fullName)}</p>
    <p><strong>Company:</strong> ${escapeHtml(input.companyName)}</p>
    <p><strong>Business email:</strong> ${escapeHtml(input.businessEmail)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone || '—')}</p>
    <p><strong>Market focus:</strong> ${escapeHtml(input.marketFocus || '—')}</p>
    <p><strong>Subscribe alerts:</strong> ${input.subscribeAlerts ? 'yes' : 'no'}</p>
  `.trim();
}
