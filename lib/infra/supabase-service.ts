import type { SupabaseClient } from '@supabase/supabase-js';
import {
	createSupabaseServerAuthClient,
	readSupabaseProjectUrl,
	readSupabaseServiceRoleKey,
} from '../supabase-env.js';

/**
 * Service role — САМО в Vercel Functions / dev API, никога в браузър.
 * За запис в таблици, bypass RLS (внимавай с правила).
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
	const url = readSupabaseProjectUrl();
	const key = readSupabaseServiceRoleKey();
	if (!url || !key) return null;
	return createSupabaseServerAuthClient(url, key);
}
