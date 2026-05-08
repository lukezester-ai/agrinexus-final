/** OpenAI-съвместим endpoint за текст и vision (един URL при Mistral). */
export const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

/** Ключ от https://console.mistral.ai — облачен EU доставчик, OpenAI-съвместим чат API. */
export function readMistralApiKey(): string {
	let k = process.env.MISTRAL_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
	k = k.replace(/\u00A0/g, ' ').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

export function readMistralModel(): string {
	return process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
}

/** Fine-tuned или друг модел само за `/api/chat` (иначе `MISTRAL_MODEL`). */
export function readMistralChatModel(): string {
	return process.env.MISTRAL_CHAT_MODEL?.trim() || readMistralModel();
}

/** Fine-tuned или друг модел за пазарни JSON инсайти (`market-watch-insights-llm` и др.). */
export function readMistralMarketInsightsModel(): string {
	return process.env.MISTRAL_MARKET_INSIGHTS_MODEL?.trim() || readMistralModel();
}

export function isMistralConfigured(): boolean {
	return Boolean(readMistralApiKey());
}
