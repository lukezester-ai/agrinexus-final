import { createClient } from '@supabase/supabase-js';
import { assertLeadFormAntiBot } from './form-bot-guard.js';
import type { LeadHandlerCtx } from './leads-handler.js';
import { readSupabaseAnonOrPublishableKey, readSupabaseProjectUrl } from './supabase-env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAllowedRedirect(redirectTo: string): boolean {
	try {
		const u = new URL(redirectTo);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
		const host = u.hostname.toLowerCase();
		if (host === 'localhost' || host === '127.0.0.1') return true;
		const site = process.env.VITE_SITE_URL?.trim();
		if (site) {
			try {
				if (new URL(site).origin === u.origin) return true;
			} catch {
				/* ignore */
			}
		}
		if (host.endsWith('.vercel.app')) return true;
		if (host === 'agrinexus.eu.com' || host.endsWith('.agrinexus.eu.com')) return true;
		return false;
	} catch {
		return false;
	}
}

export async function handleAuthMagicLinkPost(
	rawBody: unknown,
	ctx?: LeadHandlerCtx
): Promise<
	| { ok: true }
	| { ok: false; status: number; error: string; hint?: string; code?: string }
> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const b = rawBody as Record<string, unknown>;
	const anti = assertLeadFormAntiBot(b, { clientIp: ctx?.clientIp ?? null });
	if (!anti.ok) {
		return { ok: false, status: anti.status, error: anti.error, hint: anti.hint };
	}

	const email = typeof b.email === 'string' ? b.email.trim() : '';
	const redirectTo = typeof b.redirectTo === 'string' ? b.redirectTo.trim() : '';
	const fullName = typeof b.fullName === 'string' ? b.fullName.trim() : '';

	if (!email || !EMAIL_RE.test(email)) {
		return { ok: false, status: 400, error: 'Valid email required', code: 'invalid_email' };
	}
	if (!redirectTo || !isAllowedRedirect(redirectTo)) {
		return {
			ok: false,
			status: 400,
			error: 'Invalid redirect URL',
			code: 'invalid_redirect',
		};
	}

	const url = readSupabaseProjectUrl();
	const key = readSupabaseAnonOrPublishableKey();
	if (!url || !key) {
		return {
			ok: false,
			status: 503,
			error: 'Auth is not configured on the server',
			code: 'auth_not_configured',
			hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY (legacy anon JWT from Supabase → API Keys → Legacy).',
		};
	}

	const supabase = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const display = fullName || email.split('@')[0] || '';
	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: {
			emailRedirectTo: redirectTo,
			data: {
				full_name: display,
				company_name: 'Not specified',
				market_focus: 'Not specified',
				phone: '',
			},
		},
	});

	if (error) {
		const msg = (error.message || '').toLowerCase();
		if (msg.includes('api key is invalid') || msg.includes('invalid api key')) {
			return {
				ok: false,
				status: 502,
				error: 'Invalid Supabase API key on server',
				code: 'invalid_api_key',
				hint: 'Use legacy anon key (starts with eyJ) in SUPABASE_ANON_KEY, not sb_publishable, until keys are rotated.',
			};
		}
		if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
			return {
				ok: false,
				status: 409,
				error: 'Email already registered',
				code: 'already_registered',
			};
		}
		return {
			ok: false,
			status: 502,
			error: error.message || 'Auth request failed',
			code: 'auth_error',
		};
	}

	return { ok: true };
}
