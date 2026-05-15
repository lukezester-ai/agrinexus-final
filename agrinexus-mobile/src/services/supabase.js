import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** null докато няма EXPO_PUBLIC_SUPABASE_* в .env */
export const supabase =
	url && anonKey
		? createClient(url, anonKey, {
				auth: {
					persistSession: true,
					autoRefreshToken: true,
				},
			})
		: null;

export const isSupabaseConfigured = Boolean(supabase);
