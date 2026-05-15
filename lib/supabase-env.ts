import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** URL на Supabase проект (сървър; предпочита SUPABASE_URL). */
export function readSupabaseProjectUrl(): string {
	return (
		process.env.SUPABASE_URL?.trim() ||
		process.env.VITE_SUPABASE_URL?.trim() ||
		''
	);
}

/**
 * Anon / publishable ключ за Auth и публични API (не service role).
 * На сървъра предпочитаме SUPABASE_ANON_KEY (често legacy JWT).
 */
export function readSupabaseAnonOrPublishableKey(): string {
	return (
		process.env.SUPABASE_ANON_KEY?.trim() ||
		process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
		''
	);
}

/** Service role — само backend (bypass RLS). */
export function readSupabaseServiceRoleKey(): string {
	return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

/** За `auth.getUser(jwt)` — service role или anon. */
export function readSupabaseKeyForJwtVerify(): string {
	return readSupabaseServiceRoleKey() || readSupabaseAnonOrPublishableKey();
}

export function isSupabaseServerConfigured(): boolean {
	return Boolean(readSupabaseProjectUrl() && readSupabaseServiceRoleKey());
}

export function isSupabaseAuthConfigured(): boolean {
	return Boolean(readSupabaseProjectUrl() && readSupabaseAnonOrPublishableKey());
}

/** Auth клиент без persist (API routes). */
export function createSupabaseServerAuthClient(url: string, key: string): SupabaseClient {
	return createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}
