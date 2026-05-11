/** Maps SIMA product rows to delayed futures symbols on Stooq (suffix .f). Not investment advice; refs only. */

export type InstrumentMeta = {
	symbol: string;
	unitBg: string;
	unitEn: string;
};

/** Products matching marketplace catalog names in App.tsx */
export const PRODUCT_INSTRUMENT: Partial<Record<string, InstrumentMeta>> = {
	'Wheat (Premium)': {
		symbol: 'zw.f',
		unitBg: '¢/bu CBOT пшеница',
		unitEn: '¢/bu CBOT wheat',
	},
	Corn: {
		symbol: 'zc.f',
		unitBg: '¢/bu CBOT царевица',
		unitEn: '¢/bu CBOT corn',
	},
	/** No liquid barley strip on Stooq — oats curve as coarse grains proxy. */
	Barley: {
		symbol: 'zo.f',
		unitBg: '¢/bu CBOT овес (прокси за ечемик)',
		unitEn: '¢/bu CBOT oats (barley proxy)',
	},
	'Sunflower Seed': {
		symbol: 'zs.f',
		unitBg: '¢/bu CBOT соя (прокси за маслодайни)',
		unitEn: '¢/bu CBOT soybeans (oilseed proxy)',
	},
	Rapeseed: {
		symbol: 'rs.f',
		unitBg: 'CAD/t ICE канола',
		unitEn: 'CAD/t ICE canola',
	},
	/** Pulses: thin listed proxies — rough rice in USD/cwt. */
	Chickpeas: {
		symbol: 'zr.f',
		unitBg: 'USD/cwt ориз (прокси за бобови)',
		unitEn: 'USD/cwt rice (pulses proxy)',
	},
	Lentils: {
		symbol: 'zr.f',
		unitBg: 'USD/cwt ориз (прокси за бобови)',
		unitEn: 'USD/cwt rice (pulses proxy)',
	},
	'Sunflower Oil': {
		symbol: 'zl.f',
		unitBg: '¢/lb соево масло (прокси)',
		unitEn: '¢/lb soybean oil (proxy)',
	},
};

export function uniqueInstrumentSymbols(): string[] {
	const set = new Set<string>();
	for (const meta of Object.values(PRODUCT_INSTRUMENT)) {
		if (meta?.symbol) set.add(meta.symbol.toLowerCase());
	}
	return [...set];
}

/** Четими етикети по символ за LLM / операторски преглед. */
export function instrumentHumanLabels(): Record<string, { bg: string; en: string }> {
	const out: Record<string, { bg: string; en: string }> = {};
	for (const [product, meta] of Object.entries(PRODUCT_INSTRUMENT)) {
		if (!meta?.symbol) continue;
		const sym = meta.symbol.toLowerCase();
		out[sym] = {
			bg: `${product} (${meta.unitBg})`,
			en: `${product} (${meta.unitEn})`,
		};
	}
	return out;
}
