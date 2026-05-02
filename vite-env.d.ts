/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_MVP_MODE?: string;
	readonly VITE_SKIP_MARKET_QUOTES?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
