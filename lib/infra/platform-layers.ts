/**
 * Състояние на инфраструктурните слоеве (без секрети) — за /api/platform и мониторинг.
 */

import { isChatLlmConfigured } from '../ollama-env';

export type AgriPlatformLayers = {
	/** HTTP API (Vercel Functions / dev-server) */
	liveApi: true;
	/** LLM за чат: OpenAI ключ и/или Ollama URL (true ако поне един е наличен) */
	openai: boolean;
	/** Resend или SMTP */
	emailRelay: boolean;
	/** S3 / R2 — файлове */
	objectStorage: boolean;
	/** Supabase проект на сървъра (URL + ключ) — синхронизация, Edge, service role */
	supabaseServer: boolean;
	/** Генерация на документи (PDF) — в приложението */
	documentGeneration: true;
	/** Облачен доставчик за auth/DB конфигуриран за браузър (VITE_) — виж frontend */
	supabaseClientEnv: boolean;
};

export function readSupabaseServerConfigured(): boolean {
	const url = process.env.SUPABASE_URL?.trim();
	const secret =
		process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
	return Boolean(url && secret);
}

export function getAgriPlatformLayers(): AgriPlatformLayers {
	return {
		liveApi: true,
		openai: isChatLlmConfigured(),
		emailRelay: Boolean(
			process.env.RESEND_API_KEY?.trim() ||
				process.env.SMTP_HOST?.trim() ||
				process.env.MAIL_TO?.trim(),
		),
		objectStorage: Boolean(
			process.env.S3_BUCKET?.trim() &&
				process.env.S3_ACCESS_KEY_ID?.trim() &&
				process.env.S3_SECRET_ACCESS_KEY?.trim(),
		),
		supabaseServer: readSupabaseServerConfigured(),
		documentGeneration: true,
		// Браузърът чете VITE_ при билд; тук само бележка за CI — реалната стойност е в клиента
		supabaseClientEnv: Boolean(process.env.VITE_SUPABASE_URL?.trim() && process.env.VITE_SUPABASE_ANON_KEY?.trim()),
	};
}

export function getPlatformPayload(): {
	ok: true;
	name: string;
	layers: AgriPlatformLayers;
	hints: string[];
} {
	const layers = getAgriPlatformLayers();
	const hints: string[] = [];
	if (!layers.openai) hints.push('Set OPENAI_API_KEY or OLLAMA_BASE_URL (local Ollama) for AI chat.');
	if (!layers.supabaseServer && !layers.supabaseClientEnv) {
		hints.push('Add Supabase: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (frontend); SUPABASE_URL + keys on server for API sync.');
	}
	if (!layers.objectStorage) hints.push('Optional: S3_* for presigned uploads.');
	return {
		ok: true,
		name: 'agrinexus-pro',
		layers,
		hints,
	};
}
