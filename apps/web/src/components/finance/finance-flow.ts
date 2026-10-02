export type Bar = {
	bar_index: number;
	bar_time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume: string;
};

export type StrategySpec = {
	version: 2;
	entry: { all: unknown[] };
	exit: { any: unknown[] };
};

export function closesFromText(value: string): number[] {
	return value
		.split(/[\s,]+/)
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => Number(item));
}

export function barsFromCloses(closes: number[]): Bar[] {
	if (closes.length < 50 || closes.some((close) => !Number.isFinite(close) || close <= 0)) {
		throw new Error("Enter at least 50 closing prices, each above zero.");
	}
	const start = Date.UTC(2024, 0, 1);
	return closes.map((close, index) => {
		const price = close.toString();
		return {
			bar_index: index,
			bar_time: new Date(start + index * 86_400_000).toISOString(),
			open: price,
			high: price,
			low: price,
			close: price,
			volume: "1000",
		};
	});
}

export function sampleCloses(): string {
	return Array.from({ length: 60 }, (_, index) => (80 + index).toString()).join("\n");
}

export function screenSpec(minimumClose: number) {
	if (!Number.isFinite(minimumClose)) throw new Error("Enter the minimum close.");
	return {
		version: 1,
		where: {
			all: [{ op: "gt", left: { close: true }, right: { value: minimumClose } }],
		},
	};
}

export function strategySpec(fast: number, slow: number, rsiLength: number, rsiLevel: number): StrategySpec {
	if (![fast, slow, rsiLength].every((value) => Number.isInteger(value) && value > 0) || !Number.isFinite(rsiLevel)) {
		throw new Error("Averages and RSI need whole lengths above zero.");
	}
	return {
		version: 2,
		entry: {
			all: [
				{ op: "gt", left: { sma: fast }, right: { sma: slow } },
				{ op: "lt", left: { rsi: rsiLength }, right: { value: rsiLevel } },
			],
		},
		exit: {
			any: [
				{ op: "lte", left: { sma: fast }, right: { sma: slow } },
				{ op: "gte", left: { rsi: rsiLength }, right: { value: rsiLevel } },
			],
		},
	};
}

export function describeStrategy(fast: number, slow: number, rsiLength: number, rsiLevel: number): string {
	return `Enter when the ${fast}-day average is above the ${slow}-day average and the ${rsiLength}-day RSI is below ${rsiLevel}. Exit when the ${fast}-day average is at or below the ${slow}-day average, or the ${rsiLength}-day RSI is at or above ${rsiLevel}.`;
}

export function listFromText(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function riskPolicy(input: {
	instruments: string;
	strategies: string;
	forbidLong: boolean;
	maxPositions: number;
	maxDrawdown: number;
	maxExposure: number;
	maxRisk: number;
}) {
	if (![input.maxPositions, input.maxDrawdown, input.maxExposure, input.maxRisk].every((value) => Number.isFinite(value) && value >= 0)) {
		throw new Error("Risk limits need numbers that are zero or greater.");
	}
	if (!Number.isInteger(input.maxPositions)) throw new Error("Concurrent positions need a whole number.");
	return {
		allowed_instruments: listFromText(input.instruments),
		allowed_strategies: listFromText(input.strategies),
		forbidden_actions: input.forbidLong ? ["long"] : [],
		max_concurrent_positions: input.maxPositions,
		max_drawdown: input.maxDrawdown,
		max_exposure: input.maxExposure,
		max_risk_per_position: input.maxRisk,
	};
}

export const OBSERVATION_LABELS = [
	["accepted", "Accepted"],
	["rejected", "Rejected"],
	["filled", "Filled, as a recorded label"],
	["partial", "Partial"],
	["unknown", "Unknown"],
	["timeout", "Timeout"],
	["missing", "Missing"],
	["invalid", "Invalid"],
] as const;
