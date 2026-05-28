import type { AppLocale } from "@/i18n/routing";
import {
	type BreakEvenInputs,
	cbotPriceStrToEurPerTonne,
	formatEur,
	profitAtPrice,
} from "@/lib/break-even";
import { formatBasisEur, resolveMarketEurPerTonne } from "@/lib/local-price";
import type { LiveDeskPayload, LiveDeskRow } from "@/lib/market-live-desk";

export type BriefingCard = {
	title: string;
	lines: string[];
	signalLabel: string;
	suggestion: string;
	ctaLabel: string;
	ctaUrl: string;
	disclaimer: string;
};

const copy = {
	en: {
		title: (day: string) => `AgriNexus · ${day} briefing`,
		wheat: (price: string, delta: string) => `Wheat (CBOT ref): ${price} (${delta})`,
		marginPerT: (v: string) => `Your margin at this reference: ${v}/t`,
		marginFarm: (v: string) => `For your farm: ${v}`,
		noBreakEven: "Add break-even costs in Settings to see your margin here.",
		signalStrong: "Signal: strong (aligned today)",
		signalMixed: "Signal: mixed (signals disagree)",
		basis: (v: string, name: string) => `Basis (${name}): ${v}`,
		suggestion:
			"Worth reviewing a forward window this week — informational only, not a trade order.",
		cta: "Open market desk",
		disclaimer: "Informational only — not investment or trading advice. Delayed market data.",
	},
	bg: {
		title: (day: string) => `AgriNexus · ${day} briefing`,
		wheat: (price: string, delta: string) => `Пшеница (CBOT ref): ${price} (${delta})`,
		marginPerT: (v: string) => `Твоята маржа при тази референция: ${v}/t`,
		marginFarm: (v: string) => `За стопанството: ${v}`,
		noBreakEven: "Въведи себестойност в Настройки, за да видиш маржа тук.",
		signalStrong: "Сигнал: силен (съгласувани днес)",
		signalMixed: "Сигнал: смесен (сигналите се разминават)",
		basis: (v: string, name: string) => `Basis (${name}): ${v}`,
		suggestion:
			"Има смисъл да прегледаш форуърд прозорец тази седмица — само информация, не заповед за сделка.",
		cta: "Отвори пазарното табло",
		disclaimer: "Само с информационна цел — не е инвестиционен или търговски съвет. Забавени данни.",
	},
};

function weekdayName(locale: AppLocale, date = new Date()): string {
	return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
		weekday: "long",
	}).format(date);
}

function signalStrength(wheat: LiveDeskRow | undefined): "strong" | "mixed" {
	if (!wheat) return "mixed";
	return wheat.up ? "strong" : "mixed";
}

export function buildWeeklyBriefingCard(opts: {
	locale: AppLocale;
	desk: LiveDeskPayload;
	wheat?: LiveDeskRow;
	breakEven: BreakEvenInputs | null;
	totalHa: number;
	siteUrl: string;
}): BriefingCard {
	const { locale, desk, wheat, breakEven, totalHa, siteUrl } = opts;
	const c = locale === "bg" ? copy.bg : copy.en;
	const day = weekdayName(locale);
	const lines: string[] = [];

	if (wheat) {
		lines.push(c.wheat(wheat.priceStr, wheat.deltaStr));
	}

	const cbotEur = wheat ? cbotPriceStrToEurPerTonne(wheat.priceStr) : null;
	const resolved =
		breakEven != null
			? resolveMarketEurPerTonne(breakEven, cbotEur)
			: { eurPerTonne: cbotEur, source: "cbot" as const, basisEur: null };
	const refEur = resolved.eurPerTonne;

	if (breakEven && refEur != null && totalHa > 0) {
		const p = profitAtPrice(refEur, breakEven, totalHa);
		if (p) {
			const sign = p.marginPerTonne >= 0 ? "+" : "";
			lines.push(c.marginPerT(sign + formatEur(p.marginPerTonne, locale)));
			lines.push(
				c.marginFarm(sign + formatEur(p.totalFarmEur, locale)),
			);
		}
		if (resolved.basisEur != null && resolved.source !== "cbot") {
			const buyerName =
				resolved.buyer?.name ??
				(locale === "bg" ? "местна оферта" : "local quote");
			lines.push(c.basis(formatBasisEur(resolved.basisEur, locale), buyerName));
		}
	} else if (!breakEven) {
		lines.push(c.noBreakEven);
	}

	const strength = signalStrength(wheat);
	const signalLabel = strength === "strong" ? c.signalStrong : c.signalMixed;

	if (desk.warning) {
		lines.push(`⚠ ${desk.warning}`);
	}

	return {
		title: c.title(day),
		lines,
		signalLabel,
		suggestion: c.suggestion,
		ctaLabel: c.cta,
		ctaUrl: `${siteUrl.replace(/\/$/, "")}/dashboard/market`,
		disclaimer: c.disclaimer,
	};
}

/** Plain text for Telegram (no HTML parse issues). */
export function formatBriefingPlain(card: BriefingCard): string {
	return [
		card.title,
		"",
		...card.lines,
		"",
		card.signalLabel,
		card.suggestion,
		"",
		`${card.ctaLabel}: ${card.ctaUrl}`,
		"",
		card.disclaimer,
	].join("\n");
}
