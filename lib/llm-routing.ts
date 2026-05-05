/**
 * Единна логика за избор на LLM доставчик (Mistral → Ollama → OpenAI).
 * Ползва се от чат и от vision (обяснение на документ), за да няма разминаване.
 */
import {
	MISTRAL_CHAT_COMPLETIONS_URL,
	readMistralApiKey,
	readMistralModel,
	readMistralVisionModel,
} from './mistral-env';
import { readOpenAiApiKey } from './openai-api-key';
import { readOllamaBaseUrl } from './ollama-env';

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

/** Текстов чат completions — същият приоритет като досега. */
export function resolveTextChatUpstream(): TextChatUpstream | null {
	const mistralKey = readMistralApiKey();
	const ollamaBase = readOllamaBaseUrl();
	const openaiKey = readOpenAiApiKey();
	if (mistralKey) {
		return {
			provider: 'mistral',
			completionUrl: MISTRAL_CHAT_COMPLETIONS_URL,
			bearer: mistralKey,
			model: readMistralModel(),
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

export type VisionUpstream = {
	provider: LlmBackendId;
	completionUrl: string;
	bearer: string | undefined;
	model: string;
};

/** Vision completions — Pixtral / llava / OpenAI vision модел. */
export function resolveVisionUpstream(): VisionUpstream | null {
	const mistralKey = readMistralApiKey();
	const ollamaBase = readOllamaBaseUrl();
	const openaiKey = readOpenAiApiKey();
	if (mistralKey) {
		return {
			provider: 'mistral',
			completionUrl: MISTRAL_CHAT_COMPLETIONS_URL,
			bearer: mistralKey,
			model: readMistralVisionModel(),
		};
	}
	if (ollamaBase) {
		return {
			provider: 'ollama',
			completionUrl: `${ollamaBase}/v1/chat/completions`,
			bearer: undefined,
			model:
				process.env.OLLAMA_VISION_MODEL?.trim() ||
				process.env.OLLAMA_MODEL?.trim() ||
				'llava',
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
