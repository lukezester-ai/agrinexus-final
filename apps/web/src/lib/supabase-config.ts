/** Base project URL only — never include `/rest/v1` (breaks Auth → `/rest/v1/auth/v1/...`). */
export function getSupabaseUrl(): string {
	const raw =
		process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
		"https://placeholder.supabase.co";
	return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
	return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "placeholder_key";
}
