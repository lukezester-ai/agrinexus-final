export const FINANCE_MARKET_COMMANDS = [
	"finance_create_instrument",
	"finance_replace_market_bars",
	"finance_register_instrument",
	"finance_register_data_provider",
	"finance_ingest_market_bars",
	"finance_create_watchlist",
	"finance_add_watchlist_instrument",
	"finance_remove_watchlist_instrument",
	"finance_create_screener",
	"finance_run_screener",
	"finance_capture_snapshot",
] as const;

export const FINANCE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "1d", "1w"] as const;

export const FINANCE_PROVIDER_KINDS = ["fixture"] as const;

export type MarketBarInput = {
	bar_index: number;
	bar_time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume: string;
};
