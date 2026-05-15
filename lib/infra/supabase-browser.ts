import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** undefined = още не е опитано; null = няма клиент. */
let cached: SupabaseClient | null | undefined;
let initPromise: Promise<SupabaseClient | null> | null = null;

function createBrowserClient(url: string, anon: string): SupabaseClient {
	return createClient(url, anon, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	});
}

/** Синхронен клиент само от Vite env (build). */
export function getSupabaseBrowserClient(): SupabaseClient | null {
	if (cached !== undefined) return cached;
	const url = import.meta.env.VITE_SUPABASE_URL?.trim();
	const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
	if (!url || !anon) return null;
	cached = createBrowserClient(url, anon);
	return cached;
}

/** Vite env или GET /api/public-supabase-config (ключовете от сървъра). */
export async function ensureSupabaseBrowserClient(): Promise<SupabaseClient | null> {
	const fromVite = getSupabaseBrowserClient();
	if (fromVite) return fromVite;
	if (cached === null) return null;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			const res = await fetch('/api/public-supabase-config');
			const data = (await res.json()) as {
				ok?: boolean;
				supabaseUrl?: string;
				supabaseAnonKey?: string;
			};
			if (!res.ok || !data.ok || !data.supabaseUrl || !data.supabaseAnonKey) {
				cached = null;
				return null;
			}
			cached = createBrowserClient(data.supabaseUrl.trim(), data.supabaseAnonKey.trim());
			return cached;
		} catch {
			cached = null;
			return null;
		} finally {
			initPromise = null;
		}
	})();

	return initPromise;
}
