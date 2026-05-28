import type { BreakEvenInputs } from "@/lib/break-even";

function formatEurShort(n: number, locale: string): string {
	return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(n);
}

/** Official BGN/EUR peg — informational only, not FX advice. */
export const BGN_PER_EUR = 1.95583;

export type PriceCurrency = "EUR" | "BGN";

export type LocalBuyerQuote = {
	id: string;
	name: string;
	price: number;
	currency: PriceCurrency;
	/** ISO date YYYY-MM-DD */
	quoted_at?: string;
};

export type MarketPriceResolution = {
	eurPerTonne: number | null;
	source: "buyer" | "legacy" | "cbot";
	buyer?: LocalBuyerQuote;
	/** local − CBOT ref (€/t); negative = discount to futures */
	basisEur?: number | null;
};

export function newBuyerId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function quoteToEurPerTonne(price: number, currency: PriceCurrency): number {
	if (!price || price <= 0) return 0;
	if (currency === "BGN") return price / BGN_PER_EUR;
	return price;
}

export function eurToBgn(eur: number): number {
	return eur * BGN_PER_EUR;
}

export function computeBasisEurPerTonne(
	localEurPerTonne: number,
	cbotEurPerTonne: number,
): number {
	return localEurPerTonne - cbotEurPerTonne;
}

export function formatBgn(n: number, locale: string): string {
	return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
		style: "currency",
		currency: "BGN",
		maximumFractionDigits: 0,
	}).format(n);
}

export function formatBasisEur(n: number, locale: string): string {
	const sign = n >= 0 ? "+" : "";
	return `${sign}${formatEurShort(n, locale)}/t`;
}

export function parseLocalBuyers(raw: unknown): LocalBuyerQuote[] {
	if (!Array.isArray(raw)) return [];
	const out: LocalBuyerQuote[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		const price = typeof o.price === "number" ? o.price : parseFloat(String(o.price ?? ""));
		if (!price || Number.isNaN(price) || price <= 0) continue;
		const currency: PriceCurrency = o.currency === "BGN" ? "BGN" : "EUR";
		const name = typeof o.name === "string" ? o.name.trim() : "";
		out.push({
			id: typeof o.id === "string" ? o.id : newBuyerId(),
			name: name || (currency === "BGN" ? "Купувач" : "Buyer"),
			price,
			currency,
			quoted_at: typeof o.quoted_at === "string" ? o.quoted_at : undefined,
		});
	}
	return out;
}

export function getPrimaryBuyer(inputs: BreakEvenInputs): LocalBuyerQuote | null {
	const buyers =
		inputs.local_buyers?.filter((b) => b.price > 0) ?? [];
	if (buyers.length === 0) return null;
	if (inputs.primary_buyer_id) {
		const found = buyers.find((b) => b.id === inputs.primary_buyer_id);
		if (found) return found;
	}
	return buyers[0] ?? null;
}

export function syncLegacyLocalPrice(inputs: BreakEvenInputs): BreakEvenInputs {
	const primary = getPrimaryBuyer(inputs);
	const next = { ...inputs };
	if (primary) {
		next.local_price_eur_per_tonne = quoteToEurPerTonne(primary.price, primary.currency);
	}
	return next;
}

export function resolveMarketEurPerTonne(
	inputs: BreakEvenInputs,
	cbotEurPerTonne: number | null,
): MarketPriceResolution {
	const buyer = getPrimaryBuyer(inputs);
	if (buyer) {
		const eur = quoteToEurPerTonne(buyer.price, buyer.currency);
		return {
			eurPerTonne: eur,
			source: "buyer",
			buyer,
			basisEur:
				cbotEurPerTonne != null ? computeBasisEurPerTonne(eur, cbotEurPerTonne) : null,
		};
	}
	if (inputs.local_price_eur_per_tonne && inputs.local_price_eur_per_tonne > 0) {
		const eur = inputs.local_price_eur_per_tonne;
		return {
			eurPerTonne: eur,
			source: "legacy",
			basisEur:
				cbotEurPerTonne != null ? computeBasisEurPerTonne(eur, cbotEurPerTonne) : null,
		};
	}
	if (cbotEurPerTonne != null) {
		return { eurPerTonne: cbotEurPerTonne, source: "cbot", basisEur: null };
	}
	return { eurPerTonne: null, source: "cbot", basisEur: null };
}

/** Migrate old single €/t field into one buyer row on first load. */
export function hydrateLocalBuyers(inputs: BreakEvenInputs): BreakEvenInputs {
	if (inputs.local_buyers && inputs.local_buyers.length > 0) return inputs;
	if (!inputs.local_price_eur_per_tonne || inputs.local_price_eur_per_tonne <= 0) {
		return inputs;
	}
	const id = newBuyerId();
	return {
		...inputs,
		local_buyers: [
			{
				id,
				name: "Local buyer",
				price: inputs.local_price_eur_per_tonne,
				currency: "EUR",
			},
		],
		primary_buyer_id: id,
	};
}
