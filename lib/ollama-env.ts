/** Базов URL на Ollama без краен `/` (напр. http://127.0.0.1:11434). OpenAI-съвместимият endpoint е /v1/chat/completions */
export function readOllamaBaseUrl(): string {
	const u = process.env.OLLAMA_BASE_URL ?? '';
	return u.replace(/^\uFEFF/, '').trim().replace(/\/$/, '');
}

export function isOllamaConfigured(): boolean {
	return Boolean(readOllamaBaseUrl());
}
