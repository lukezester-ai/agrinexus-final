/**
 * Standalone copy: Mistral → Ollama → OpenAI (OpenAI-compatible chat completions).
 */

const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions';

function readMistralApiKey(): string {
	let k = process.env.MISTRAL_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
	k = k.replace(/\u00A0/g, ' ').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

function readMistralModel(): string {
	return process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
}

function readMistralChatModel(): string {
	return process.env.MISTRAL_CHAT_MODEL?.trim() || readMistralModel();
}

function readOpenAiApiKey(): string {
	let k = process.env.OPENAI_API_KEY ?? '';
	k = k.replace(/^\uFEFF/, '').trim();
	if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
		k = k.slice(1, -1).trim();
	}
	return k;
}

function readOllamaBaseUrl(): string {
	const u = process.env.OLLAMA_BASE_URL ?? '';
	return u.replace(/^\uFEFF/, '').trim().replace(/\/$/, '');
}

export type LlmBackendId = 'mistral' | 'ollama' | 'openai';

export type TextChatUpstream = {
	provider: LlmBackendId;
	completionUrl: string;
	bearer: string | undefined;
	model: string;
};

export function resolveTextChatUpstream(): TextChatUpstream | null {
	const mistralKey = readMistralApiKey();
	const ollamaBase = readOllamaBaseUrl();
	const openaiKey = readOpenAiApiKey();
	if (mistralKey) {
		return {
			provider: 'mistral',
			completionUrl: MISTRAL_CHAT_COMPLETIONS_URL,
			bearer: mistralKey,
			model: readMistralChatModel(),
		};
	}
	if (ollamaBase) {
		return {
			provider: 'ollama',
			completionUrl: `${ollamaBase}/v1/chat/completions`,
			bearer: undefined,
			model: process.env.OLLAMA_MODEL?.trim() || 'llama3.2',
		};
	}
	if (openaiKey) {
		return {
			provider: 'openai',
			completionUrl: 'https://api.openai.com/v1/chat/completions',
			bearer: openaiKey,
			model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
		};
	}
	return null;
}

export function chatProviderLabel(p: LlmBackendId): string {
	if (p === 'mistral') return 'Mistral';
	if (p === 'ollama') return 'Ollama';
	return 'OpenAI';
}

export function openAIMessageContentToString(content: unknown): string {
	if (content == null) return '';
	if (typeof content === 'string') return content.trim();
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const item of content) {
			if (item && typeof item === 'object' && 'type' in item) {
				const p = item as { type?: string; text?: string };
				if (p.type === 'text' && typeof p.text === 'string') parts.push(p.text);
			}
		}
		return parts.join('\n').trim();
	}
	return '';
}

export function isAnyLlmConfigured(): boolean {
	return resolveTextChatUpstream() !== null;
}
