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
	lang: 'bg' | 'en',
	serverError?: string
): string {
	const bg = lang === 'bg';
	const detail = serverError?.trim().slice(0, 240);
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
				? 'Регистрацията временно не е налична (липсват настройки на сървъра).'
				: 'Registration is temporarily unavailable (server not configured).';
		case 'invalid_api_key':
			return bg
				? 'Грешка в настройките на сървъра. Опитайте по-късно.'
				: 'Server configuration error. Try again later.';
		case 'too_fast':
			return bg
				? 'Твърде бързо — изчакай 2–3 секунди и опитай отново.'
				: 'Too fast — wait 2–3 seconds and try again.';
		case 'api_blocked':
			return bg
				? 'Сървърът блокира заявката (често при preview URL). Отвори основния сайт agrinexus.eu.com.'
				: 'The server blocked the request (common on preview URLs). Use agrinexus.eu.com.';
		case 'invalid_response':
			return bg
				? 'Невалиден отговор от сървъра. Опитай основния домейн или по-късно.'
				: 'Invalid server response. Try the main domain or again later.';
		case 'auth_error':
			if (detail) {
				if (/rate limit|too many/i.test(detail)) {
					return bg
						? 'Твърде много опити — изчакай малко и опитай отново.'
						: 'Too many attempts — wait a moment and try again.';
				}
				if (/invalid email|email.*invalid/i.test(detail)) {
					return bg ? 'Имейлът не е приет от системата.' : 'Email was rejected by the auth service.';
				}
				return detail;
			}
			return bg ? 'Регистрацията не успя. Опитайте отново.' : 'Registration failed. Try again.';
		default:
			return detail || (bg ? 'Неуспешно. Опитайте отново.' : 'Something went wrong. Try again.');
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
	const contentType = res.headers.get('content-type') ?? '';
	let body: AuthApiBody;
	try {
		if (!contentType.includes('application/json')) {
			const text = (await res.text()).slice(0, 120);
			const blocked = /authentication required|vercel/i.test(text);
			return {
				ok: false,
				status: res.status,
				body: {
					ok: false,
					code: blocked ? 'api_blocked' : 'invalid_response',
					error: blocked ? 'Deployment protection' : 'Non-JSON response',
				},
			};
		}
		body = (await res.json()) as AuthApiBody;
	} catch {
		body = { ok: false, code: 'invalid_response', error: 'Could not parse response' };
	}
	if (!res.ok || !body.ok) {
		if (res.status === 429 && !body.code) body.code = 'too_fast';
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
