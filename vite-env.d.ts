/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_MVP_MODE?: string;
	readonly VITE_SKIP_MARKET_QUOTES?: string;
	/** Supabase project URL (public) */
	readonly VITE_SUPABASE_URL?: string;
	/** Supabase anon key (public) */
	readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
