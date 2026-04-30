import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildContactEmailHtml,
  buildRegisterEmailHtml,
  sendInboundNotification,
} from './email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

function normalizePhone(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return `+${digitsOnly}`.slice(0, 16);
}

async function maybeAppendJsonl(record: Record<string, unknown>): Promise<void> {
  if (process.env.AGRI_STORE_LEADS !== '1') return;
  const dir = join(process.cwd(), '.local');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
  await appendFile(join(dir, 'leads.jsonl'), line, 'utf8');
}

export async function handleContactPost(
  rawBody: unknown
): Promise<{ ok: true } | { ok: false; status: number; error: string; hint?: string }> {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }
  const b = rawBody as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const company = typeof b.company === 'string' ? b.company.trim() : '';

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: 'Valid email is required', hint: 'Provide a valid business email.' };
  }
  if (message.length < 8) {
    return { ok: false, status: 400, error: 'Message too short', hint: 'Please write at least a short message.' };
  }
  if (message.length > 12000) {
    return { ok: false, status: 400, error: 'Message too long' };
  }

  await maybeAppendJsonl({ type: 'contact', name, email, company, messagePreview: message.slice(0, 280) });

  const html = buildContactEmailHtml({ name, email, company, message });
  const mail = await sendInboundNotification({
    subject: `[AgriNexus] Contact · ${name || email}`,
    html,
    replyTo: email,
  });
  if (mail.status === 'failed') {
    return {
      ok: false,
      status: 502,
      error: 'Email delivery failed',
      hint: mail.error,
    };
  }

  return { ok: true };
}

export async function handleRegisterInterestPost(
  rawBody: unknown
): Promise<{ ok: true; preview?: string } | { ok: false; status: number; error: string; hint?: string }> {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }
  const b = rawBody as Record<string, unknown>;
  const fullName = typeof b.fullName === 'string' ? b.fullName.trim() : '';
  const companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
  const businessEmail = typeof b.businessEmail === 'string' ? b.businessEmail.trim() : '';
  const phone = typeof b.phone === 'string' ? normalizePhone(b.phone) : '';
  const marketFocus = typeof b.marketFocus === 'string' ? b.marketFocus.trim() : '';
  const subscribeAlerts = Boolean(b.subscribeAlerts);

  if (!fullName || fullName.length < 2) {
    return { ok: false, status: 400, error: 'Full name required' };
  }
  if (!businessEmail || !EMAIL_RE.test(businessEmail)) {
    return { ok: false, status: 400, error: 'Valid business email required' };
  }
  if (!companyName) {
    return { ok: false, status: 400, error: 'Company name required' };
  }
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, status: 400, error: 'Valid phone required', hint: 'Provide phone in E.164 format, e.g. +359881234567.' };
  }

  const preview = `${fullName} · ${companyName} · ${businessEmail} · ${marketFocus || '—'} · alerts:${subscribeAlerts ? 'yes' : 'no'} · ${phone || 'no phone'}`;
  await maybeAppendJsonl({
    type: 'register-interest',
    fullName,
    companyName,
    businessEmail,
    phone,
    marketFocus,
    subscribeAlerts,
  });

  const html = buildRegisterEmailHtml({
    fullName,
    companyName,
    businessEmail,
    phone,
    marketFocus,
    subscribeAlerts,
  });
  const mail = await sendInboundNotification({
    subject: `[AgriNexus] Registration · ${companyName}`,
    html,
    replyTo: businessEmail,
  });
  if (mail.status === 'failed') {
    return {
      ok: false,
      status: 502,
      error: 'Email delivery failed',
      hint: mail.error,
    };
  }

  return { ok: true, preview };
}

export async function handleFileMetaPost(
  rawBody: unknown
): Promise<{ ok: true; received: number } | { ok: false; status: number; error: string }> {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }
  const body = rawBody as { files?: unknown; uploads?: unknown; senderEmail?: unknown };
  const senderEmail = typeof body.senderEmail === 'string' ? body.senderEmail.trim().slice(0, 320) : '';

  const uploadsRaw = body.uploads;
  const uploads: { key: string; name: string; size: number; publicUrl?: string }[] = [];
  if (Array.isArray(uploadsRaw)) {
    for (const u of uploadsRaw.slice(0, 12)) {
      if (!u || typeof u !== 'object') continue;
      const o = u as Record<string, unknown>;
      const key = typeof o.key === 'string' ? o.key.trim().slice(0, 500) : '';
      const name = typeof o.name === 'string' ? o.name.slice(0, 240) : '';
      const size = typeof o.size === 'number' && o.size >= 0 ? o.size : 0;
      const publicUrl = typeof o.publicUrl === 'string' ? o.publicUrl.trim().slice(0, 800) : undefined;
      if (key && name) uploads.push({ key, name, size, publicUrl });
    }
  }

  const files = body.files;
  const safe =
    Array.isArray(files) && files.length > 0
      ? files.slice(0, 12).map((f) => {
          if (!f || typeof f !== 'object') return null;
          const o = f as Record<string, unknown>;
          return {
            name: typeof o.name === 'string' ? o.name.slice(0, 240) : 'unknown',
            size: typeof o.size === 'number' && o.size >= 0 ? o.size : 0,
            type: typeof o.type === 'string' ? o.type.slice(0, 120) : '',
          };
        })
      : [];
  const meta = safe.filter((x): x is NonNullable<typeof x> => x != null);

  if (uploads.length === 0 && meta.length === 0) {
    return { ok: false, status: 400, error: 'Provide files and/or uploads[]' };
  }

  await maybeAppendJsonl({
    type: 'file-meta',
    files: meta,
    uploads: uploads.length ? uploads : undefined,
    senderEmail: senderEmail || undefined,
  });
  return { ok: true, received: uploads.length || meta.length };
}
