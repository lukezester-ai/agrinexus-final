export type AuthMagicLinkPayload = {
	email: string;
	redirectTo: string;
	fullName?: string;
	hpCompanyWebsite?: string;
	formOpenedAt: number;
};

export type AuthMagicLinkResponse = {
	ok?: boolean;
	error?: string;
	hint?: string;
	code?: string;
};

export async function requestAuthMagicLink(
	payload: AuthMagicLinkPayload
): Promise<{ ok: true } | { ok: false; status: number; body: AuthMagicLinkResponse }> {
	const res = await fetch('/api/auth-magic-link', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	let body: AuthMagicLinkResponse;
	try {
		body = (await res.json()) as AuthMagicLinkResponse;
	} catch {
		body = {};
	}
	if (!res.ok || body.ok === false) {
		return { ok: false, status: res.status, body };
	}
	return { ok: true };
}

export function authMagicLinkErrorMessage(
	code: string | undefined,
	lang: 'bg' | 'en'
): string {
	if (code === 'already_registered') {
		return lang === 'bg'
			? 'Този имейл вече е регистриран. Влез от „Вход“.'
			: 'This email is already registered. Use Sign in.';
	}
	if (code === 'invalid_api_key' || code === 'auth_not_configured') {
		return lang === 'bg'
			? 'Входът временно не е наличен. Опитай по-късно или пиши на info@agrinexus.eu.'
			: 'Sign-in is temporarily unavailable. Try again later or email info@agrinexus.eu.';
	}
	return lang === 'bg'
		? 'Неуспешно изпращане на връзката. Опитай пак след малко.'
		: 'Could not send the sign-in link. Please try again shortly.';
}
