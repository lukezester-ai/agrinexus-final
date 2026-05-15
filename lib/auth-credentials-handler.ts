import { assertLeadFormAntiBot } from './form-bot-guard.js';
import type { LeadHandlerCtx } from './leads-handler.js';
import {
	createSupabaseServerAuthClient,
	readSupabaseAnonOrPublishableKey,
	readSupabaseProjectUrl,
} from './supabase-env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 6;

export type AuthSessionPayload = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
};

type AuthFail = {
	ok: false;
	status: number;
	error: string;
	hint?: string;
	code?: string;
};

type AuthOkSignup =
	| { ok: true; session: AuthSessionPayload }
	| { ok: true; needsEmailConfirmation: true };

type AuthOkSignin = { ok: true; session: AuthSessionPayload };

function readEmailPassword(
	raw: Record<string, unknown>
): { ok: true; email: string; password: string } | AuthFail {
	const email = typeof raw.email === 'string' ? raw.email.trim() : '';
	const password = typeof raw.password === 'string' ? raw.password : '';
	if (!email || !EMAIL_RE.test(email)) {
		return { ok: false, status: 400, error: 'Valid email required', code: 'invalid_email' };
	}
	if (password.length < MIN_PASSWORD_LEN) {
		return {
			ok: false,
			status: 400,
			error: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
			code: 'invalid_password',
		};
	}
	return { ok: true, email, password };
}

function mapSupabaseAuthError(message: string): AuthFail {
	const msg = message.toLowerCase();
	if (msg.includes('api key is invalid') || msg.includes('invalid api key')) {
		return {
			ok: false,
			status: 502,
			error: 'Auth service misconfigured',
			code: 'invalid_api_key',
			hint: 'Server needs legacy anon JWT in SUPABASE_ANON_KEY.',
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
	if (
		msg.includes('email rate limit') ||
		msg.includes('over_email_send') ||
		msg.includes('over_request_rate')
	) {
		return {
			ok: false,
			status: 429,
			error: message || 'Email rate limit exceeded',
			code: 'email_rate_limit',
			hint: 'Supabase limits confirmation emails. Wait ~1 hour, try Sign in if you already registered, or disable email confirmation in Supabase Auth settings.',
		};
	}
	if (msg.includes('rate limit') || msg.includes('too many')) {
		return {
			ok: false,
			status: 429,
			error: message || 'Too many requests',
			code: 'auth_error',
		};
	}
	if (
		msg.includes('invalid login') ||
		msg.includes('invalid credentials') ||
		msg.includes('wrong password') ||
		msg.includes('email not confirmed')
	) {
		return {
			ok: false,
			status: 401,
			error: 'Invalid email or password',
			code: 'invalid_credentials',
		};
	}
	return {
		ok: false,
		status: 502,
		error: message || 'Auth request failed',
		code: 'auth_error',
	};
}

function requireAuthClient():
	| { ok: true; client: ReturnType<typeof createSupabaseServerAuthClient> }
	| AuthFail {
	const url = readSupabaseProjectUrl();
	const key = readSupabaseAnonOrPublishableKey();
	if (!url || !key) {
		return {
			ok: false,
			status: 503,
			error: 'Registration is not available',
			code: 'auth_not_configured',
			hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.',
		};
	}
	return { ok: true, client: createSupabaseServerAuthClient(url, key) };
}

function sessionFromData(session: {
	access_token: string;
	refresh_token: string;
	expires_in?: number;
} | null): AuthSessionPayload | null {
	if (!session?.access_token || !session.refresh_token) return null;
	return {
		access_token: session.access_token,
		refresh_token: session.refresh_token,
		expires_in: session.expires_in ?? 3600,
	};
}

export async function handleAuthSignupPost(
	rawBody: unknown,
	ctx?: LeadHandlerCtx
): Promise<AuthOkSignup | AuthFail> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const b = rawBody as Record<string, unknown>;
	const anti = assertLeadFormAntiBot(b, { clientIp: ctx?.clientIp ?? null });
	if (!anti.ok) {
		return { ok: false, status: anti.status, error: anti.error, hint: anti.hint };
	}

	const creds = readEmailPassword(b);
	if (!creds.ok) return creds;

	const resolved = requireAuthClient();
	if (!resolved.ok) return resolved;
	const { client } = resolved;

	const { data, error } = await client.auth.signUp({
		email: creds.email,
		password: creds.password,
		options: {
			data: {
				full_name: creds.email.split('@')[0] || '',
			},
		},
	});

	if (error) return mapSupabaseAuthError(error.message);

	const session = sessionFromData(data.session);
	if (session) return { ok: true, session };
	return { ok: true, needsEmailConfirmation: true };
}

export async function handleAuthSigninPost(
	rawBody: unknown,
	ctx?: LeadHandlerCtx
): Promise<AuthOkSignin | AuthFail> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const b = rawBody as Record<string, unknown>;
	const anti = assertLeadFormAntiBot(b, { clientIp: ctx?.clientIp ?? null });
	if (!anti.ok) {
		return { ok: false, status: anti.status, error: anti.error, hint: anti.hint };
	}

	const creds = readEmailPassword(b);
	if (!creds.ok) return creds;

	const resolved = requireAuthClient();
	if (!resolved.ok) return resolved;
	const { client } = resolved;

	const { data, error } = await client.auth.signInWithPassword({
		email: creds.email,
		password: creds.password,
	});

	if (error) return mapSupabaseAuthError(error.message);

	const session = sessionFromData(data.session);
	if (!session) {
		return {
			ok: false,
			status: 502,
			error: 'No session returned',
			code: 'auth_error',
		};
	}
	return { ok: true, session };
}
