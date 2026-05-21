import { PRODUCT_INSTRUMENT } from './market-instruments';
import type { DealRow, Lang } from './appTypes';

export function getDecisionByProfit(profit: number) {
	if (profit >= 21) return 'BUY';
	if (profit >= 13) return 'HOLD';
	return 'AVOID';
}

export function getDecisionBySignals(input: {
	profit: number;
	volatility: 'LOW' | 'MED' | 'HIGH';
	category: DealRow['category'];
}): string {
	let score = input.profit;
	if (input.category === 'Grains') score -= 1;
	if (input.volatility === 'HIGH') score -= 2;
	else if (input.volatility === 'MED') score -= 1;
	return getDecisionByProfit(score);
}

export function getVolatility(current: number, previous: number): 'LOW' | 'MED' | 'HIGH' {
	const delta = Math.abs(current - previous);
	if (delta >= 5) return 'HIGH';
	if (delta >= 3) return 'MED';
	return 'LOW';
}

/** Avoid uncaught exceptions when storage is blocked (private mode, enterprise policy) — those crash the whole app with a blank screen. */
export function safeLocalGet(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function safeLocalSet(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

export function safeSessionGet(key: string): string | null {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

export function safeSessionSet(key: string, value: string): void {
	try {
		sessionStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

export function safeSessionRemove(key: string): void {
	try {
		sessionStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

export function mergeLiveIntoDeals(
	deals: DealRow[],
	quotes: Array<{ symbol: string; open: number; close: number }>,
	lang: Lang,
): DealRow[] {
	const bySym = new Map(quotes.map(q => [q.symbol.toLowerCase(), q]));
	return deals.map(deal => {
		const inst = PRODUCT_INSTRUMENT[deal.product];
		if (!inst) {
			return { ...deal, priceSource: 'synthetic' as const, referenceSymbol: undefined };
		}
		const q = bySym.get(inst.symbol.toLowerCase());
		if (!q) {
			return { ...deal, priceSource: 'synthetic' as const, referenceSymbol: undefined };
		}
		const unit = lang === 'bg' ? inst.unitBg : inst.unitEn;
		const pct = q.open !== 0 ? ((q.close - q.open) / q.open) * 100 : 0;
		const profit = Math.min(34, Math.max(6, Math.round(16 + pct * 1.8)));
		const prevProfit = Math.min(34, Math.max(6, Math.round(16 + (pct - 0.35) * 1.8)));
		const volatility: DealRow['volatility'] =
			Math.abs(pct) >= 2 ? 'HIGH' : Math.abs(pct) >= 0.85 ? 'MED' : 'LOW';
		const decimals = inst.symbol === 'zr.f' ? 3 : 2;
		const price = `${q.close.toFixed(decimals)} ${unit}`;
		const prevPrice = `${q.open.toFixed(decimals)} ${unit}`;
		return {
			...deal,
			price,
			prevPrice,
			profit,
			prevProfit,
			margin: Math.max(5, profit - 4),
			volatility,
			decision: getDecisionBySignals({ profit, volatility, category: deal.category }),
			priceSource: 'futures_delayed' as const,
			referenceSymbol: inst.symbol,
		};
	});
}