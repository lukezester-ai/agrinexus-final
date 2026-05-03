import { isAnyLlmConfigured } from './llm-routing';

/** Има ли конфигуриран поне един доставчик за чат (облак или локален). */
export function isChatLlmConfigured(): boolean {
	return isAnyLlmConfigured();
}
