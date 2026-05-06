import { compactMarketWatchForPrompt } from './market-watch-compact.js';
import {
	MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT,
	MARKET_WATCH_INSIGHTS_USER_NOTE,
} from './market-watch-insights-prompt.js';
import type { MarketWatchPayloadV1 } from './market-watch-types.js';

/** Един ред JSONL за Mistral FT от текущото payload в singleton (ако има lastInsights). */
export function marketWatchPayloadToMistralFtJsonLine(payload: MarketWatchPayloadV1): string | null {
	const li = payload.lastInsights;
	if (!li || (!li.summaryBg && !li.predictionsBg)) return null;

	const output = {
		summaryBg: li.summaryBg ?? '',
		predictionsBg: li.predictionsBg ?? '',
		marketModels: payload.marketModels ?? [],
	};
	const userPayload = {
		note: MARKET_WATCH_INSIGHTS_USER_NOTE,
		data: compactMarketWatchForPrompt(payload),
	};
	return JSON.stringify({
		messages: [
			{ role: 'system', content: MARKET_WATCH_INSIGHTS_SYSTEM_PROMPT },
			{ role: 'user', content: JSON.stringify(userPayload) },
			{ role: 'assistant', content: JSON.stringify(output) },
		],
	});
}
