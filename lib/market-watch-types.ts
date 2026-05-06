/** Персистентно състояние за проследяване на котировки и „пазарни модели“. */

export type MarketSymbolRollStats = {
	closes: number[];
	samples: number;
	lastClose: number;
	lastDate: string;
	prevClose?: number;
	sma20?: number;
	deltaPct?: number;
	trendLabel?: 'up' | 'down' | 'flat';
};

export type MarketWatchSnapshotRow = {
	symbol: string;
	close: number;
	date: string;
};

export type MarketWatchModelCluster = {
	id: string;
	labelBg: string;
	symbols: string[];
	thesisBg?: string;
};

export type MarketWatchPayloadV1 = {
	version: 1;
	symbolStats: Record<string, MarketSymbolRollStats>;
	snapshots: Array<{ at: string; rows: MarketWatchSnapshotRow[] }>;
	marketModels?: MarketWatchModelCluster[];
	lastInsights?: {
		at: string;
		summaryBg: string;
		predictionsBg: string;
		model?: string;
		error?: string;
	};
	persistCount: number;
	lastPersistAt?: string;
};
