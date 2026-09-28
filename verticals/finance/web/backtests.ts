export const FINANCE_BACKTEST_COMMAND = "finance_run_backtest" as const;

export type RiskMetrics = {
	trade_count: number;
	closed_pnl: string;
	paper_pnl: string;
	ending_equity: string;
	total_return: string;
	max_drawdown: string;
};
