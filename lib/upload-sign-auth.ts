import { timingSafeEqual } from 'node:crypto';
import { isDeployProductionLike } from './deploy-env.js';
import {
	createSupabaseServerAuthClient,
	readSupabaseAnonOrPublishableKey,
	readSupabaseProjectUrl,
} from './supabase-env.js';

function bearerToken(authHeader: string | undefined): string | null {
	if (!authHeader || typeof authHeader !== 'string') return null;
	const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
	return m?.[1]?.trim() ?? null;
}

function timingSafeSecretMatch(expected: string, received: string): boolean {
	try {
		const a = Buffer.from(expected, 'utf8');
		const b = Buffer.from(received, 'utf8');
		if (a.length !== b.length || a.length === 0) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

async function verifySupabaseAccessToken(accessToken: string): Promise<boolean> {
	const url = readSupabaseProjectUrl();
	const anon = readSupabaseAnonOrPublishableKey();
	if (!url || !anon) return false;
	const sb = createSupabaseServerAuthClient(url, anon);
	const {
		data: { user },
		error,
	} = await sb.auth.getUser(accessToken);
	return !error && Boolean(user);
}

/**
 * Presigned upload: в продукция изисква Bearer UPLOAD_SIGN_SECRET или валиден Supabase access_token,
 * освен ако UPLOAD_SIGN_ALLOW_ANONYMOUS=1. Локално dev допуска анонимни заявки за по-лесно тестване.
 */
export async function verifyUploadSignAuth(
	authHeader: string | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
	if (process.env.UPLOAD_SIGN_ALLOW_ANONYMOUS === '1') {
		return { ok: true };
	}

	const secret = process.env.UPLOAD_SIGN_SECRET?.trim();
	const tok = bearerToken(authHeader);
	if (secret && tok && timingSafeSecretMatch(secret, tok)) {
		return { ok: true };
	}

	if (tok) {
		const supabaseOk = await verifySupabaseAccessToken(tok);
		if (supabaseOk) return { ok: true };
	}

	if (isDeployProductionLike()) {
		return {
			ok: false,
			status: 401,
			error:
				'Unauthorized: set Authorization Bearer to your Supabase session token, or UPLOAD_SIGN_SECRET for scripts. Optional UPLOAD_SIGN_ALLOW_ANONYMOUS=1 disables this check (not recommended).',
		};
	}

	return { ok: true };
}
