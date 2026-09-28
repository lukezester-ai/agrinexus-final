export const FINANCE_MARKET_COMMANDS = [
	"finance_create_instrument",
	"finance_replace_market_bars",
] as const;

export type MarketBarInput = {
	bar_index: number;
	bar_time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume: string;
};
