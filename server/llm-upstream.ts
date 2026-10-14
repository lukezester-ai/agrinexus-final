const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

function readMistralApiKey(): string {
	let k = process.env.MISTRAL_API_KEY ?? '';
	k = k.trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

function readOpenAiApiKey(): string {
	let k = process.env.OPENAI_API_KEY ?? '';
	k = k.trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

export type LlmBackendId = 'mistral' | 'openai';

export type TextChatUpstream = {
	provider: LlmBackendId;
	completionUrl: string;
	bearer: string | undefined;
	model: string;
	supportsTools: boolean;
};

export function resolveTextChatUpstream(): TextChatUpstream | null {
	const mistralKey = readMistralApiKey();
	if (mistralKey) {
		return {
			provider: 'mistral',
			completionUrl: MISTRAL_CHAT_COMPLETIONS_URL,
			bearer: mistralKey,
			model: process.env.MISTRAL_CHAT_MODEL?.trim() || 'mistral-small-latest',
			supportsTools: true,
		};
	}
	const openaiKey = readOpenAiApiKey();
	if (openaiKey) {
		return {
			provider: 'openai',
			completionUrl: 'https://api.openai.com/v1/chat/completions',
			bearer: openaiKey,
			model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
			supportsTools: true,
		};
	}
	return null;
}

export function isAnyLlmConfigured(): boolean {
	return resolveTextChatUpstream() !== null;
}

export function openAIMessageContentToString(content: unknown): string {
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text?: string }).text ?? '') : ''))
			.join('');
	}
	return '';
}
