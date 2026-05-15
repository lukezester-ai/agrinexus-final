import { ensureSupabaseBrowserClient } from './infra/supabase-browser.js';

export type AuthSessionPayload = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
};

type AuthApiBody = {
	ok?: boolean;
	error?: string;
	hint?: string;
	code?: string;
	session?: AuthSessionPayload;
	needsEmailConfirmation?: boolean;
};

export async function applyAuthSession(session: AuthSessionPayload): Promise<boolean> {
	const sb = await ensureSupabaseBrowserClient();
	if (!sb) return false;
	const { error } = await sb.auth.setSession({
		access_token: session.access_token,
		refresh_token: session.refresh_token,
	});
	return !error;
}

export function authCredentialsErrorMessage(
	code: string | undefined,
	lang: 'bg' | 'en'
): string {
	const bg = lang === 'bg';
	switch (code) {
		case 'invalid_email':
			return bg ? 'Въведете валиден имейл.' : 'Enter a valid email.';
		case 'invalid_password':
			return bg ? 'Паролата трябва да е поне 6 знака.' : 'Password must be at least 6 characters.';
		case 'already_registered':
			return bg ? 'Този имейл вече е регистриран. Влезте с парола.' : 'This email is already registered. Sign in.';
		case 'invalid_credentials':
			return bg ? 'Грешен имейл или парола.' : 'Invalid email or password.';
		case 'auth_not_configured':
			return bg
				? 'Регистрацията временно не е налична.'
				: 'Registration is temporarily unavailable.';
		case 'invalid_api_key':
			return bg
				? 'Грешка в настройките на сървъра. Опитайте по-късно.'
				: 'Server configuration error. Try again later.';
		default:
			return bg ? 'Неуспешно. Опитайте отново.' : 'Something went wrong. Try again.';
	}
}

async function postAuth(
	path: string,
	payload: Record<string, unknown>
): Promise<
	| { ok: true; session?: AuthSessionPayload; needsEmailConfirmation?: boolean }
	| { ok: false; status: number; body: AuthApiBody }
> {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	let body: AuthApiBody;
	try {
		body = (await res.json()) as AuthApiBody;
	} catch {
		body = {};
	}
	if (!res.ok || !body.ok) {
		return { ok: false, status: res.status, body };
	}
	return {
		ok: true,
		session: body.session,
		needsEmailConfirmation: body.needsEmailConfirmation,
	};
}

export async function requestAuthSignup(payload: {
	email: string;
	password: string;
	hpCompanyWebsite?: string;
	formOpenedAt: number;
}) {
	return postAuth('/api/auth-signup', payload);
}

export async function requestAuthSignin(payload: {
	email: string;
	password: string;
	hpCompanyWebsite?: string;
	formOpenedAt: number;
}) {
	return postAuth('/api/auth-signin', payload);
}
