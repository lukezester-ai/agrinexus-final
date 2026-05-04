/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Локален API порт от DEV_API_PORT (inject от vite.config; подразбиране 8788) */
	readonly VITE_DEV_API_PORT?: string;
	readonly VITE_MVP_MODE?: string;
	readonly VITE_SKIP_MARKET_QUOTES?: string;
	/** Supabase project URL (public) */
	readonly VITE_SUPABASE_URL?: string;
	/** Supabase anon key (public) */
	readonly VITE_SUPABASE_ANON_KEY?: string;
	/** Canonical site URL for links/PDF (e.g. https://agrinexus.eu.com or http://localhost:5173) */
	readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
