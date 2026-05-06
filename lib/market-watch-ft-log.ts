import { getSupabaseServiceClient } from './infra/supabase-service.js';

export type MarketWatchFtLoggedOutput = {
	summaryBg: string;
	predictionsBg: string;
	marketModels: Array<{ id: string; labelBg: string; symbols: string[]; thesisBg?: string }>;
};

/**
 * Записва ред за бъдещ експорт към Mistral JSONL. Изисква MARKET_WATCH_FT_LOG=1 и service Supabase.
 * Грешки не хвърля — само за инженеринг на dataset.
 */
export async function appendMarketWatchFtRow(input: {
	input_compact: unknown;
	output: MarketWatchFtLoggedOutput;
	model_used?: string;
}): Promise<void> {
	if (process.env.MARKET_WATCH_FT_LOG !== '1') return;

	const client = getSupabaseServiceClient();
	if (!client) return;

	const { error } = await client.from('market_watch_ft_rows').insert({
		input_compact: input.input_compact,
		output_json: input.output,
		model_used: input.model_used ?? null,
	});
	if (error) {
		console.warn('[market_watch_ft_rows]', error.message);
	}
}
