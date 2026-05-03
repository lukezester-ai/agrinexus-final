/** Чете OpenAI API ключ от средата с поправки за типични грешки при `.env` (Windows BOM, кавички). */
export function readOpenAiApiKey(): string {
	let k = process.env.OPENAI_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

export function isOpenAiConfigured(): boolean {
	return Boolean(readOpenAiApiKey());
}
