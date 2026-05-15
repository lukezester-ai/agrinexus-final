import {
	isSupabaseAuthConfigured,
	readSupabaseAnonOrPublishableKey,
	readSupabaseProjectUrl,
} from './supabase-env.js';

function anonKeyKind(key: string): 'legacy_jwt' | 'publishable' | 'unknown' {
	if (key.startsWith('eyJ')) return 'legacy_jwt';
	if (key.startsWith('sb_publishable_')) return 'publishable';
	return 'unknown';
}

/** Safe diagnostics for registration (no secret values). */
export function handleAuthStatusGet() {
	const url = readSupabaseProjectUrl();
	const anon = readSupabaseAnonOrPublishableKey();
	const configured = isSupabaseAuthConfigured();
	return {
		ok: true,
		authConfigured: configured,
		supabaseUrlSet: Boolean(url),
		anonKeySet: Boolean(anon),
		anonKeyKind: anon ? anonKeyKind(anon) : null,
		hint: !configured
			? 'Set SUPABASE_URL and SUPABASE_ANON_KEY on Vercel (legacy anon JWT recommended for Auth).'
			: anonKeyKind(anon) === 'publishable'
				? 'Publishable key works for many flows; if sign-in fails after signup, add legacy anon JWT (eyJ…) as SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY.'
				: null,
	};
}
