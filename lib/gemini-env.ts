/** Ключ от Google AI Studio: https://aistudio.google.com/apikey */
export function readGeminiApiKey(): string {
	let k = process.env.GEMINI_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

export function readGeminiModel(): string {
	return process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
}

/** За мултимодални заявки (снимка на документ); по подразбиране същият като GEMINI_MODEL. */
export function readGeminiVisionModel(): string {
	return (
		process.env.GEMINI_VISION_MODEL?.trim() ||
		process.env.GEMINI_MODEL?.trim() ||
		'gemini-2.0-flash'
	);
}

export function isGeminiConfigured(): boolean {
	return Boolean(readGeminiApiKey());
}
