/**
 * Единна логика за избор на LLM доставчик (Mistral → Ollama → OpenAI).
 */
import {
	MISTRAL_CHAT_COMPLETIONS_URL,
	readMistralApiKey,
	readMistralChatModel,
	readMistralMarketInsightsModel,
	readMistralModel,
} from './mistral-env.js';
import { readOpenAiApiKey } from './openai-api-key.js';
import { readOllamaBaseUrl } from './ollama-env.js';

export type LlmBackendId = 'mistral' | 'ollama' | 'openai';

export function isAnyLlmConfigured(): boolean {
	return Boolean(readMistralApiKey() || readOllamaBaseUrl() || readOpenAiApiKey());
}

export type TextChatUpstream = {
	provider: LlmBackendId;
	completionUrl: string;
	bearer: string | undefined;
	model: string;
	/** Ollama често не поддържа response_format json_object — false там. */
	useJsonObjectFormat: boolean;
};

/** За Mistral: различни FT модели за чат vs структурирани пазарни изводи. Останалите доставчици игнорират `kind`. */
export type TextChatUpstreamKind = 'chat' | 'market_insights';

/** Текстов чат completions — същият приоритет като досега. */
export function resolveTextChatUpstream(kind?: TextChatUpstreamKind): TextChatUpstream | null {
	const mistralKey = readMistralApiKey();
	const ollamaBase = readOllamaBaseUrl();
	const openaiKey = readOpenAiApiKey();
	if (mistralKey) {
		const mistralModel =
			kind === 'chat'
				? readMistralChatModel()
				: kind === 'market_insights'
					? readMistralMarketInsightsModel()
					: readMistralModel();
		return {
			provider: 'mistral',
			completionUrl: MISTRAL_CHAT_COMPLETIONS_URL,
			bearer: mistralKey,
			model: mistralModel,
			useJsonObjectFormat: true,
		};
	}
	if (ollamaBase) {
		return {
			provider: 'ollama',
			completionUrl: `${ollamaBase}/v1/chat/completions`,
			bearer: undefined,
			model: process.env.OLLAMA_MODEL?.trim() || 'llama3.2',
			useJsonObjectFormat: false,
		};
	}
	if (openaiKey) {
		return {
			provider: 'openai',
			completionUrl: 'https://api.openai.com/v1/chat/completions',
			bearer: openaiKey,
			model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
			useJsonObjectFormat: true,
		};
	}
	return null;
}

export function chatProviderLabel(p: LlmBackendId): string {
	if (p === 'mistral') return 'Mistral';
	if (p === 'ollama') return 'Ollama';
	return 'OpenAI';
}

/** OpenAI-съвместимо съдържание на assistant message. */
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
