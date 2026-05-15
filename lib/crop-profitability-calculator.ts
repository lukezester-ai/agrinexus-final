/**
 * Ориентировъчен марж по култура (неофициален) — за търговия и Fieldlot.
 * Добив: kg/дка; цена: лв/т; разходи: лв/дка + опционални общи фиксирани лв.
 */

export type CropProfitLang = 'bg' | 'en';

export type CropPresetId = 'wheat' | 'sunflower' | 'corn' | 'barley' | 'custom';

export interface CropProfitabilityInput {
	decares: number;
	yieldKgPerDecare: number;
	priceBgnPerTonne: number;
	variableCostBgnPerDecare: number;
	fixedCostBgn: number;
}

export interface CropProfitabilityResult {
	hectares: number;
	totalYieldTonnes: number;
	revenueBgn: number;
	variableCostsBgn: number;
	totalCostsBgn: number;
	marginTotalBgn: number;
	marginPerDecareBgn: number;
	marginPerHectareBgn: number;
	breakEvenYieldKgPerDecare: number | null;
	breakEvenPriceBgnPerTonne: number | null;
}

export type CropProfitErrorCode =
	| 'DECARES_MIN'
	| 'DECARES_MAX'
	| 'YIELD_MIN'
	| 'PRICE_MIN'
	| 'COST_NEGATIVE';

export const CROP_PRESETS: Record<
	Exclude<CropPresetId, 'custom'>,
	{ yieldKgPerDecare: number; priceBgnPerTonne: number; variableCostBgnPerDecare: number }
> = {
	wheat: { yieldKgPerDecare: 45, priceBgnPerTonne: 380, variableCostBgnPerDecare: 180 },
	sunflower: { yieldKgPerDecare: 22, priceBgnPerTonne: 520, variableCostBgnPerDecare: 200 },
	corn: { yieldKgPerDecare: 55, priceBgnPerTonne: 340, variableCostBgnPerDecare: 220 },
	barley: { yieldKgPerDecare: 40, priceBgnPerTonne: 360, variableCostBgnPerDecare: 170 },
};

export function validateCropProfitabilityInput(
	input: CropProfitabilityInput
): CropProfitErrorCode | null {
	if (!Number.isFinite(input.decares) || input.decares < 0.5) return 'DECARES_MIN';
	if (input.decares > 100_000) return 'DECARES_MAX';
	if (!Number.isFinite(input.yieldKgPerDecare) || input.yieldKgPerDecare <= 0) return 'YIELD_MIN';
	if (!Number.isFinite(input.priceBgnPerTonne) || input.priceBgnPerTonne <= 0) return 'PRICE_MIN';
	if (
		!Number.isFinite(input.variableCostBgnPerDecare) ||
		input.variableCostBgnPerDecare < 0 ||
		!Number.isFinite(input.fixedCostBgn) ||
		input.fixedCostBgn < 0
	) {
		return 'COST_NEGATIVE';
	}
	return null;
}

export function estimateCropProfitability(input: CropProfitabilityInput): CropProfitabilityResult {
	const ha = input.decares / 10;
	const totalYieldTonnes = (input.decares * input.yieldKgPerDecare) / 1000;
	const revenueBgn = totalYieldTonnes * input.priceBgnPerTonne;
	const variableCostsBgn = input.decares * input.variableCostBgnPerDecare;
	const totalCostsBgn = variableCostsBgn + input.fixedCostBgn;
	const marginTotalBgn = revenueBgn - totalCostsBgn;
	const marginPerDecareBgn = marginTotalBgn / input.decares;
	const marginPerHectareBgn = ha > 0 ? marginTotalBgn / ha : 0;

	const costPerDecare = input.variableCostBgnPerDecare + input.fixedCostBgn / input.decares;
	const pricePerKg = input.priceBgnPerTonne / 1000;
	const breakEvenYieldKgPerDecare =
		pricePerKg > 0 ? Math.round((costPerDecare / pricePerKg) * 10) / 10 : null;
	const breakEvenPriceBgnPerTonne =
		totalYieldTonnes > 0 ? Math.round((totalCostsBgn / totalYieldTonnes) * 10) / 10 : null;

	return {
		hectares: ha,
		totalYieldTonnes,
		revenueBgn: Math.round(revenueBgn),
		variableCostsBgn: Math.round(variableCostsBgn),
		totalCostsBgn: Math.round(totalCostsBgn),
		marginTotalBgn: Math.round(marginTotalBgn),
		marginPerDecareBgn: Math.round(marginPerDecareBgn),
		marginPerHectareBgn: Math.round(marginPerHectareBgn),
		breakEvenYieldKgPerDecare,
		breakEvenPriceBgnPerTonne,
	};
}

export function formatCropProfitShareSnippet(
	input: CropProfitabilityInput,
	result: CropProfitabilityResult,
	siteUrl: string,
	lang: CropProfitLang = 'bg'
): string {
	const u = siteUrl.replace(/\/$/, '');
	const loc = lang === 'en' ? 'en-GB' : 'bg-BG';
	const margin = result.marginPerDecareBgn.toLocaleString(loc);
	const total = result.marginTotalBgn.toLocaleString(loc);
	if (lang === 'en') {
		return `Crop margin (indicative): ${input.decares} decares → ~${margin} BGN/decare, ~${total} BGN total. ${u}`;
	}
	return `Марж по култура (ориентир): ${input.decares} дка → ~${margin} лв/дка, общо ~${total} лв. ${u}`;
}
