import { hydrateLocalBuyers, parseLocalBuyers, type LocalBuyerQuote } from "@/lib/local-price";

/** ~36.74 bu per metric tonne (SRW wheat). */
const BU_PER_TONNE = 36.7437;
/** Rough USD→EUR for desk reference only (not FX advice). */
const EUR_PER_USD = 1 / 1.08;

export type { LocalBuyerQuote };

export type BreakEvenInputs = {
	cost_seeds_eur_per_ha: number;
	cost_fertilizer_eur_per_ha: number;
	cost_fuel_eur_per_ha: number;
	cost_rent_eur_per_ha: number;
	cost_other_eur_per_ha: number;
	yield_t_per_ha: number;
	/** Synced from primary buyer — kept for older clients */
	local_price_eur_per_tonne?: number;
	/** Elevator / co-op quotes (EUR or BGN per tonne) */
	local_buyers?: LocalBuyerQuote[];
	primary_buyer_id?: string;
};

export const BREAK_EVEN_STORAGE_KEY = "agrinexus_break_even_v1";

export const DEFAULT_BREAK_EVEN_INPUTS: BreakEvenInputs = {
	cost_seeds_eur_per_ha: 0,
	cost_fertilizer_eur_per_ha: 0,
	cost_fuel_eur_per_ha: 0,
	cost_rent_eur_per_ha: 0,
	cost_other_eur_per_ha: 0,
	yield_t_per_ha: 6,
};

export function totalCostEurPerHa(inputs: BreakEvenInputs): number {
	return (
		inputs.cost_seeds_eur_per_ha +
		inputs.cost_fertilizer_eur_per_ha +
		inputs.cost_fuel_eur_per_ha +
		inputs.cost_rent_eur_per_ha +
		inputs.cost_other_eur_per_ha
	);
}

export function computeBreakEvenEurPerTonne(inputs: BreakEvenInputs): number | null {
	const y = inputs.yield_t_per_ha;
	if (!y || y <= 0) return null;
	const perHa = totalCostEurPerHa(inputs);
	if (perHa <= 0) return null;
	return perHa / y;
}

export function profitAtPrice(
	marketEurPerTonne: number,
	inputs: BreakEvenInputs,
	totalHa: number,
): {
	breakEvenEurPerTonne: number;
	marginPerTonne: number;
	totalFarmEur: number;
} | null {
	const breakEven = computeBreakEvenEurPerTonne(inputs);
	if (breakEven == null || !totalHa || totalHa <= 0) return null;
	const marginPerTonne = marketEurPerTonne - breakEven;
	const tonnes = totalHa * inputs.yield_t_per_ha;
	return {
		breakEvenEurPerTonne: breakEven,
		marginPerTonne,
		totalFarmEur: marginPerTonne * tonnes,
	};
}

/** Parse desk row like `$5.234/bu` → approximate €/t (CBOT reference, not local buyer). */
export function cbotPriceStrToEurPerTonne(priceStr: string): number | null {
	const m = priceStr.match(/\$([0-9.]+)\s*\/\s*bu/i);
	if (!m) return null;
	const usdPerBu = parseFloat(m[1]);
	if (Number.isNaN(usdPerBu) || usdPerBu <= 0) return null;
	const usdPerTonne = usdPerBu * BU_PER_TONNE;
	return usdPerTonne * EUR_PER_USD;
}

export function parseBreakEvenInputs(raw: unknown): BreakEvenInputs | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const num = (k: keyof BreakEvenInputs) => {
		const v = o[k];
		return typeof v === "number" && !Number.isNaN(v) ? v : 0;
	};
	const inputs: BreakEvenInputs = {
		cost_seeds_eur_per_ha: num("cost_seeds_eur_per_ha"),
		cost_fertilizer_eur_per_ha: num("cost_fertilizer_eur_per_ha"),
		cost_fuel_eur_per_ha: num("cost_fuel_eur_per_ha"),
		cost_rent_eur_per_ha: num("cost_rent_eur_per_ha"),
		cost_other_eur_per_ha: num("cost_other_eur_per_ha"),
		yield_t_per_ha: num("yield_t_per_ha") || 6,
	};
	if (typeof o.local_price_eur_per_tonne === "number" && o.local_price_eur_per_tonne > 0) {
		inputs.local_price_eur_per_tonne = o.local_price_eur_per_tonne;
	}
	const buyers = parseLocalBuyers(o.local_buyers);
	if (buyers.length > 0) inputs.local_buyers = buyers;
	if (typeof o.primary_buyer_id === "string") {
		inputs.primary_buyer_id = o.primary_buyer_id;
	}
	if (totalCostEurPerHa(inputs) <= 0) return null;
	return hydrateLocalBuyers(inputs);
}

export function formatEur(n: number, locale: string): string {
	return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(n);
}

export function formatEurPerTonne(n: number, locale: string): string {
	return `${formatEur(n, locale)}/t`;
}
