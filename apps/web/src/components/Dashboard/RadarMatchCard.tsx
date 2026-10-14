import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { RadarItem } from "@/lib/business-radar";
import { isRadarMatchKind, matchPercent, matchStrength, positiveReasonCodes } from "@/lib/business-radar";
import { glossary, matchCardCopy, productLocale } from "@/lib/product-ux-copy";
import { TrustEligibilitySignal } from "@/components/Dashboard/TrustEligibilitySignal";

const WHY_CODES = ["industry_match", "target_market_overlap", "kind_compatibility"] as const;

function cardTone(item: RadarItem): string {
	if (item.item_kind === "pending_introduction") {
		return "border-[#e2b657]/50";
	}
	return "border-white/15";
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
			className={`border px-5 py-5 ${cardTone(item)}`}
			data-testid={`radar-item-${item.item_kind}`}
		>
			<p className="text-[11px] tracking-[0.18em] text-white/45">{c.found}</p>
			<h3 className="mt-1.5 text-[17px] font-light leading-snug text-white">
				{isRelationship ? (
					<Link href={`/dashboard/relationships/${item.item_id}`} className="text-white no-underline hover:text-white/70">
						{title}
					</Link>
				) : (
					title
				)}
			</h3>
			{item.safe_summary ? <p className="mt-1.5 text-sm leading-relaxed text-white/70">{item.safe_summary}</p> : null}

			{percent != null && strengthLabel ? (
				<div className="mt-5 border-t border-white/10 pt-4">
					<p className="text-[11px] tracking-[0.18em] text-white/45">{c.why}</p>
					<p className="mt-2 text-2xl font-light leading-none text-white" data-testid="radar-match-strength">
						{strengthLabel}
					</p>
					<p className="mt-2 text-sm text-white/55" data-testid="radar-criteria-alignment">
						<span dir="ltr" className="inline-block tabular-nums text-white">
							{percent}%
						</span>{" "}
						{c.criteriaAlignment}
					</p>
					{reasons.length > 0 ? (
						<ul className="mt-3 flex flex-col gap-1">
							{reasons.map((label) => (
								<li key={label} className="text-sm leading-snug text-white/70" data-testid="radar-reason">
									{label}
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}

			{confidential ? (
				<div className="mt-5 border border-white/15 px-3.5 py-3">
					<p className="text-[11px] tracking-[0.18em] text-[#e2b657]">{c.hidden}</p>
					<p className="mt-1.5 text-sm leading-relaxed text-white/70" data-testid="radar-confidential">
						<span className="text-white">{g.confidential}.</span> {c.confidentialBody}
					</p>
				</div>
			) : null}
			{isRadarMatchKind(item.item_kind) ? <TrustEligibilitySignal locale={locale} /> : null}

			<div className="mt-5 border-t border-white/10 pt-4">
				<p className="text-[11px] tracking-[0.18em] text-white/45">{c.next}</p>
				{isRelationship && item.status ? (
					<p className="mt-2 text-[13px] capitalize text-white/80">{item.status}</p>
				) : null}
				{actions}
			</div>
		</li>
	);
}
