import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service role — САМО в Vercel Functions / dev API, никога в браузър.
 * За запис в таблици, bypass RLS (внимавай с правила).
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
	const url = process.env.SUPABASE_URL?.trim();
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !key) return null;
	return createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}
