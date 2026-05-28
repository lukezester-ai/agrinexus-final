import type { BreakEvenInputs } from "@/lib/break-even";
import { cbotPriceStrToEurPerTonne, computeBreakEvenEurPerTonne, profitAtPrice } from "@/lib/break-even";
import { quoteToEurPerTonne, resolveMarketEurPerTonne, type PriceCurrency } from "@/lib/local-price";

export const DIARY_STORAGE_KEY = "agrinexus_decision_diary_v1";

export type DecisionAction =
	| "sell"
	| "hold"
	| "forward"
	| "hedge"
	| "other";

export type MarketSnapshot = {
	cbot_eur_per_tonne?: number | null;
	cbot_price_str?: string | null;
	local_eur_per_tonne?: number | null;
	basis_eur_per_tonne?: number | null;
	break_even_eur_per_tonne?: number | null;
	margin_eur_per_tonne?: number | null;
	captured_at?: string;
};

export type DecisionDiaryEntry = {
	id: string;
	user_id: string;
	decided_at: string;
	crop: string;
	action: DecisionAction;
	tonnes: number | null;
	price_per_tonne: number | null;
	price_currency: PriceCurrency;
	buyer_name: string | null;
	rationale: string | null;
	market_snapshot: MarketSnapshot | null;
	outcome_notes: string | null;
	outcome_rating: number | null;
	created_at?: string;
	updated_at?: string;
};

export type NewDecisionInput = {
	decided_at: string;
	action: DecisionAction;
	tonnes?: number;
	price_per_tonne?: number;
	price_currency?: PriceCurrency;
	buyer_name?: string;
	rationale?: string;
};

const ACTIONS: DecisionAction[] = ["sell", "hold", "forward", "hedge", "other"];

export function isDecisionAction(v: string): v is DecisionAction {
	return ACTIONS.includes(v as DecisionAction);
}

export function parseDecisionRow(raw: Record<string, unknown>): DecisionDiaryEntry | null {
	const id = typeof raw.id === "string" ? raw.id : null;
	const user_id = typeof raw.user_id === "string" ? raw.user_id : "";
	if (!id) return null;

	const action = typeof raw.action === "string" && isDecisionAction(raw.action) ? raw.action : "other";
	const currency: PriceCurrency = raw.price_currency === "BGN" ? "BGN" : "EUR";

	return {
		id,
		user_id,
		decided_at: typeof raw.decided_at === "string" ? raw.decided_at : new Date().toISOString(),
		crop: typeof raw.crop === "string" ? raw.crop : "wheat",
		action,
		tonnes: typeof raw.tonnes === "number" ? raw.tonnes : null,
		price_per_tonne: typeof raw.price_per_tonne === "number" ? raw.price_per_tonne : null,
		price_currency: currency,
		buyer_name: typeof raw.buyer_name === "string" ? raw.buyer_name : null,
		rationale: typeof raw.rationale === "string" ? raw.rationale : null,
		market_snapshot:
			raw.market_snapshot && typeof raw.market_snapshot === "object"
				? (raw.market_snapshot as MarketSnapshot)
				: null,
		outcome_notes: typeof raw.outcome_notes === "string" ? raw.outcome_notes : null,
		outcome_rating:
			typeof raw.outcome_rating === "number" ? raw.outcome_rating : null,
		created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
		updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
	};
}

export async function buildMarketSnapshot(opts: {
	wheatPriceStr?: string | null;
	cbotEurPerTonne?: number | null;
	breakEven: BreakEvenInputs | null;
	totalHa: number;
}): Promise<MarketSnapshot> {
	const cbotEur =
		opts.cbotEurPerTonne ??
		(opts.wheatPriceStr ? cbotPriceStrToEurPerTonne(opts.wheatPriceStr) : null);

	const resolved =
		opts.breakEven != null
			? resolveMarketEurPerTonne(opts.breakEven, cbotEur)
			: { eurPerTonne: cbotEur, source: "cbot" as const, basisEur: null };

	const breakEvenEur = opts.breakEven
		? computeBreakEvenEurPerTonne(opts.breakEven)
		: null;

	let margin: number | null = null;
	if (
		opts.breakEven &&
		resolved.eurPerTonne != null &&
		opts.totalHa > 0
	) {
		const p = profitAtPrice(resolved.eurPerTonne, opts.breakEven, opts.totalHa);
		margin = p?.marginPerTonne ?? null;
	}

	return {
		cbot_eur_per_tonne: cbotEur,
		cbot_price_str: opts.wheatPriceStr ?? null,
		local_eur_per_tonne: resolved.eurPerTonne,
		basis_eur_per_tonne: resolved.basisEur ?? null,
		break_even_eur_per_tonne: breakEvenEur,
		margin_eur_per_tonne: margin,
		captured_at: new Date().toISOString(),
	};
}

export function pricePerTonneToEur(
	price: number | null | undefined,
	currency: PriceCurrency,
): number | null {
	if (price == null || price <= 0) return null;
	return quoteToEurPerTonne(price, currency);
}

export function formatDecisionDate(iso: string, locale: string): string {
	try {
		return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
			dateStyle: "medium",
		}).format(new Date(iso));
	} catch {
		return iso.slice(0, 10);
	}
}

export function loadDiaryFromStorage(): DecisionDiaryEntry[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(DIARY_STORAGE_KEY);
		if (!raw) return [];
		const arr = JSON.parse(raw) as Record<string, unknown>[];
		if (!Array.isArray(arr)) return [];
		return arr
			.map((row) => parseDecisionRow(row))
			.filter((e): e is DecisionDiaryEntry => e != null);
	} catch {
		return [];
	}
}

export function saveDiaryToStorage(entries: DecisionDiaryEntry[]): void {
	try {
		localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(entries));
	} catch {
		/* ignore */
	}
}
