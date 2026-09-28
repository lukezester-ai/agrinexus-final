export const V1_LONG_RULE = {
	version: 1,
	entry: "long",
	all: [
		{ op: "gt", left: { sma: 20 }, right: { sma: 50 } },
		{ op: "lt", left: { rsi: 14 }, right: { value: 70 } },
	],
} as const;

export const FINANCE_STRATEGY_COMMANDS = [
	"finance_create_strategy",
	"finance_validate_strategy",
	"finance_execute_strategy",
] as const;

export const FINANCE_STRATEGY_LIFECYCLE = ["draft", "validated", "backtested"] as const;
