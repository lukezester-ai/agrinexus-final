import { createClient } from '@supabase/supabase-js';

export type ResolvedAuthUser = { userId: string; email: string | null };

function readSupabaseUrl(): string {
	return (
		process.env.SUPABASE_URL?.trim() ||
		process.env.VITE_SUPABASE_URL?.trim() ||
		''
	);
}

/** Anon или service key — само за `auth.getUser(jwt)` на сървъра, не се изпраща към клиента. */
function readSupabaseKeyForJwtVerify(): string {
	return (
		process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
		process.env.SUPABASE_ANON_KEY?.trim() ||
		process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
		''
	);
}

export async function resolveUserFromAccessToken(
	accessToken: string | null | undefined
): Promise<
	| { ok: true; user: ResolvedAuthUser }
	| { ok: false; status: 401 | 503; error: string; hint?: string }
> {
	const trimmed = typeof accessToken === 'string' ? accessToken.trim() : '';
	if (!trimmed) {
		return {
			ok: false,
			status: 401,
			error: 'Изисква се вход',
			hint: 'Отвори /?from=fieldlot&mode=login — същият акаунт като в AgriNexus.',
		};
	}
	const url = readSupabaseUrl();
	const key = readSupabaseKeyForJwtVerify();
	if (!url || !key) {
		return {
			ok: false,
			status: 503,
			error: 'Сървърът не може да провери сесията',
			hint: 'Задай SUPABASE_URL и SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY.',
		};
	}
	const supabase = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const { data, error } = await supabase.auth.getUser(trimmed);
	if (error || !data.user) {
		return {
			ok: false,
			status: 401,
			error: 'Невалидна или изтекла сесия',
			hint: 'Влез отново от приложението и презареди тази страница.',
		};
	}
	return {
		ok: true,
		user: { userId: data.user.id, email: data.user.email ?? null },
	};
}
