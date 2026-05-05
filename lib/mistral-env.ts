/** OpenAI-съвместим endpoint за текст и vision (един URL при Mistral). */
export const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

/** Ключ от https://console.mistral.ai — облачен EU доставчик, OpenAI-съвместим чат API. */
export function readMistralApiKey(): string {
	let k = process.env.MISTRAL_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

export function readMistralModel(): string {
	return process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
}

/** За мултимодални заявки (снимка на документ), напр. pixtral. */
export function readMistralVisionModel(): string {
	return (
		process.env.MISTRAL_VISION_MODEL?.trim() ||
		process.env.MISTRAL_MODEL?.trim() ||
		'pixtral-12b-2409'
	);
}

export function isMistralConfigured(): boolean {
	return Boolean(readMistralApiKey());
}
