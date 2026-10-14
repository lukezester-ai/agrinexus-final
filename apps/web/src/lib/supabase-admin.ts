import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase-config";

/** Service role — server only (cron, Telegram webhook). Never expose to the client. */
export function createAdminClient(): SupabaseClient | null {
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!key) return null;
	return createClient(getSupabaseUrl(), key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

/** Fallback for dev when service role is missing (same as anon — RLS may block bulk reads). */
export function createServerSupabase() {
	return createClient(getSupabaseUrl(), getSupabaseAnonKey());
}
