import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

/** Браузърен клиент (anon). Връща null ако липсват VITE_SUPABASE_* . */
export function getSupabaseBrowserClient(): SupabaseClient | null {
	if (cached !== undefined) return cached;
	const url = import.meta.env.VITE_SUPABASE_URL?.trim();
	const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
	if (!url || !anon) {
		cached = null;
		return null;
	}
	cached = createClient(url, anon, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	});
	return cached;
}
