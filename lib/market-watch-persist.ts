import type { MarketQuotePayload } from './market-quotes-handler.js';
import { compactMarketWatchForPrompt } from './market-watch-compact.js';
import { appendMarketWatchFtRow } from './market-watch-ft-log.js';
import { generateMarketWatchInsightsWithLlm } from './market-watch-insights-llm.js';
import { MARKET_WATCH_INSIGHTS_USER_NOTE } from './market-watch-insights-prompt.js';
import {
	mergeQuotesIntoMarketWatch,
	shouldThrottleMarketWatchPersist,
} from './market-watch-learn.js';
import { defaultMarketWatchPayload, loadMarketWatchState, saveMarketWatchState } from './market-watch-state.js';
import { isAnyLlmConfigured } from './llm-routing.js';

function llmEveryNSnapshots(): number {
	const n = Number(process.env.MARKET_WATCH_LLM_EVERY_N_SNAPSHOTS);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

/**
 * Записва snapshot от живи котировки + опционално обновява LLM „модели“ и предположения.
 * Безопасно за липсващ Supabase — излиза тихо.
 */
export async function persistMarketWatchSnapshot(quotes: MarketQuotePayload[], fetchedAt: string): Promise<void> {
	if (process.env.MARKET_WATCH_PERSIST !== '1') return;
	if (!quotes.length) return;

	try {
		let prev = await loadMarketWatchState();
		if (!prev || prev.version !== 1) prev = defaultMarketWatchPayload();

		const nowMs = Date.now();
		if (shouldThrottleMarketWatchPersist(prev, nowMs)) return;

		let next = mergeQuotesIntoMarketWatch(prev, quotes, fetchedAt);
		next = {
			...next,
			persistCount: prev.persistCount + 1,
			lastPersistAt: fetchedAt,
		};

		const every = llmEveryNSnapshots();
		if (
			process.env.MARKET_WATCH_LLM_INSIGHTS === '1' &&
			isAnyLlmConfigured() &&
			next.persistCount % every === 0
		) {
			const ins = await generateMarketWatchInsightsWithLlm(next);
			const compactInputBeforeModels = compactMarketWatchForPrompt(next);
			if (ins.marketModels.length > 0) {
				next.marketModels = ins.marketModels;
			}
			if (ins.summaryBg || ins.predictionsBg) {
				next.lastInsights = {
					at: fetchedAt,
					summaryBg: ins.summaryBg,
					predictionsBg: ins.predictionsBg,
					model: ins.model,
					...(ins.error ? { error: ins.error } : {}),
				};
			}
			if (
				process.env.MARKET_WATCH_FT_LOG === '1' &&
				!ins.error &&
				(ins.summaryBg || ins.predictionsBg)
			) {
				void appendMarketWatchFtRow({
					input_compact: {
						note: MARKET_WATCH_INSIGHTS_USER_NOTE,
						data: compactInputBeforeModels,
					},
					output: {
						summaryBg: ins.summaryBg,
						predictionsBg: ins.predictionsBg,
						marketModels: ins.marketModels,
					},
					model_used: ins.model,
				});
			}
		}

		await saveMarketWatchState(next);
	} catch {
		/* ignore persistence failures */
	}
}
