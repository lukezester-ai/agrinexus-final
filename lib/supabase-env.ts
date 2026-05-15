/** URL на Supabase проект (сървър / build). */
export function readSupabaseProjectUrl(): string {
	return (
		process.env.SUPABASE_URL?.trim() ||
		process.env.VITE_SUPABASE_URL?.trim() ||
		''
	);
}

/**
 * Ключ за Auth / anon API (не service role).
 * На сървъра предпочитаме SUPABASE_ANON_KEY (често legacy JWT).
 */
export function readSupabaseAnonOrPublishableKey(): string {
	return (
		process.env.SUPABASE_ANON_KEY?.trim() ||
		process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
		''
	);
}
