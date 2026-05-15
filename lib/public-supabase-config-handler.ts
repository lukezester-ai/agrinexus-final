import { readSupabaseAnonOrPublishableKey, readSupabaseProjectUrl } from './supabase-env.js';

export function handlePublicSupabaseConfigGet():
	| { ok: true; supabaseUrl: string; supabaseAnonKey: string }
	| { ok: false; status: number; error: string } {
	const supabaseUrl = readSupabaseProjectUrl();
	const supabaseAnonKey = readSupabaseAnonOrPublishableKey();
	if (!supabaseUrl || !supabaseAnonKey) {
		return {
			ok: false,
			status: 503,
			error: 'Липсва публична Supabase конфигурация (URL + anon key).',
		};
	}
	return { ok: true, supabaseUrl, supabaseAnonKey };
}
