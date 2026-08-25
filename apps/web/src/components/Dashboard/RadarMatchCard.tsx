import type { ReactNode } from "react";
import type { RadarItem } from "@/lib/business-radar";
import { isRadarMatchKind, matchPercent, matchStrength, positiveReasonCodes } from "@/lib/business-radar";
import { glossary, matchCardCopy, productLocale } from "@/lib/product-ux-copy";

const WHY_CODES = ["industry_match", "target_market_overlap", "kind_compatibility"] as const;

function cardTone(item: RadarItem, confidential: boolean): string {
	if (item.item_kind === "relationship") {
		return "border-forest-200 bg-forest-50/40";
	}
	if (item.item_kind === "pending_introduction") {
		return "border-harvest-200 bg-harvest-50/35";
	}
	if (confidential) {
		return "border-ink/[0.08] bg-white";
	}
	return "border-ink/[0.08] bg-white";
}

export function RadarMatchCard({
	item,
	actions,
	locale,
}: {
	item: RadarItem;
	actions: ReactNode;
	locale: string;
}) {
	const loc = productLocale(locale);
	const c = matchCardCopy[loc];
	const g = glossary[loc];
	const title =
		item.safe_title ||
		[item.organization_a_name, item.organization_b_name].filter(Boolean).join(" · ") ||
		c.fallbackTitle;
	const percent = matchPercent(item.score);
	const positive = new Set(positiveReasonCodes(item.reasons));
	const reasons = WHY_CODES.filter((code) => positive.has(code)).map(
		(code) => c.reasons[code] ?? code.replaceAll("_", " "),
	);
	const confidential = isRadarMatchKind(item.item_kind) && !item.organization_a_name && !item.organization_b_name;
	const isRelationship = item.item_kind === "relationship";
	const strength = percent == null ? null : matchStrength(percent);
	const strengthLabel =
		strength === "strong"
			? g.strongMatch
			: strength === "good"
				? c.goodMatch
				: strength === "possible"
					? c.possibleMatch
					: null;

	return (
		<li
			className={`rounded-2xl border px-5 py-5 shadow-[0_1px_2px_rgba(10,10,10,0.04)] ${cardTone(item, confidential)}`}
			data-testid={`radar-item-${item.item_kind}`}
		>
			<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{c.found}</p>
			<h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.015em] text-ink">{title}</h3>
			{item.safe_summary ? <p className="mt-1.5 text-[14px] leading-relaxed text-ink/58">{item.safe_summary}</p> : null}

			{percent != null && strengthLabel ? (
				<div className="mt-5 border-t border-ink/[0.06] pt-4">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{c.why}</p>
					<p className="mt-2 font-serif text-[1.45rem] leading-none tracking-[-0.02em] text-ink" data-testid="radar-match-strength">
						{strengthLabel}
					</p>
					<p className="mt-2 text-[14px] text-ink/55" data-testid="radar-criteria-alignment">
						<span dir="ltr" className="inline-block tabular-nums font-medium text-ink">
							{percent}%
						</span>{" "}
						{c.criteriaAlignment}
					</p>
					{reasons.length > 0 ? (
						<ul className="mt-3 flex flex-col gap-1">
							{reasons.map((label) => (
								<li key={label} className="text-[14px] leading-snug text-ink/68" data-testid="radar-reason">
									{label}
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}

			{confidential ? (
				<div className="mt-5 rounded-xl border border-harvest-200/80 bg-harvest-50/70 px-3.5 py-3">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-harvest-700">{c.hidden}</p>
					<p className="mt-1.5 text-[14px] leading-relaxed text-ink/70" data-testid="radar-confidential">
						<span className="font-semibold text-ink">{g.confidential}.</span> {c.confidentialBody}
					</p>
				</div>
			) : null}

			<div className="mt-5 border-t border-ink/[0.06] pt-4">
				<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{c.next}</p>
				{isRelationship && item.status ? (
					<p className="mt-2 text-[13px] font-medium capitalize text-forest-700">{item.status}</p>
				) : null}
				{actions}
			</div>
		</li>
	);
}
