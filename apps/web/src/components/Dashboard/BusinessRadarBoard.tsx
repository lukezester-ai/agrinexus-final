"use client";

import { useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import type { RadarItem, RadarItemKind, RadarSummary } from "@/lib/business-radar";
import { RadarMatchCard } from "@/components/Dashboard/RadarMatchCard";
import { radarBoardCopy, productLocale } from "@/lib/product-ux-copy";
import {
	alertError,
	journeyFact,
	journeyLead,
	journeyPage,
	journeySectionTitle,
	journeyTitle,
	primaryAction,
	quietAction,
	secondaryAction,
	waitingPanel,
} from "@/components/Dashboard/journey-ui";

const PRIMARY_ORDER: RadarItemKind[] = ["candidate_match", "pending_introduction", "qualified_match"];
const SECONDARY_ORDER: RadarItemKind[] = ["relationship", "open_opportunity"];

function matchIdFor(item: RadarItem, introductionMatchIds: Record<string, string>): string | null {
	if (item.item_kind === "candidate_match" || item.item_kind === "qualified_match") return item.item_id;
	if (item.item_kind === "pending_introduction") return introductionMatchIds[item.item_id] ?? null;
	return null;
}

function sortPrimary(items: RadarItem[], introductionMatchIds: Record<string, string>): RadarItem[] {
	const pendingMatchIds = new Set(Object.values(introductionMatchIds));
	const rank = (kind: RadarItemKind) => {
		const i = PRIMARY_ORDER.indexOf(kind);
		return i === -1 ? 99 : i;
	};
	return items
		.filter((item) => PRIMARY_ORDER.includes(item.item_kind))
		.filter((item) => !(item.item_kind === "qualified_match" && pendingMatchIds.has(item.item_id)))
		.sort((a, b) => rank(a.item_kind) - rank(b.item_kind));
}

export function BusinessRadarBoard({
	locale,
	summary,
	items,
	introductionMatchIds,
	loadError,
	hasActiveIntent = false,
	e2e = null,
}: {
	locale: string;
	summary: RadarSummary;
	items: RadarItem[];
	introductionMatchIds: Record<string, string>;
	loadError: string | null;
	hasActiveIntent?: boolean;
	e2e?: { role: string; secret: string } | null;
}) {
	const c = radarBoardCopy[productLocale(locale)];
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string | null>(null);

	function runRpc(fn: string, args: Record<string, unknown>) {
		startTransition(async () => {
			setMessage(null);
			if (e2e) {
				const res = await fetch("/api/e2e/radar-action", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ secret: e2e.secret, role: e2e.role, fn, args }),
				});
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				if (!res.ok) {
					setMessage(body.error ?? `HTTP ${res.status}`);
					return;
				}
				window.location.reload();
				return;
			} else {
				const { error } = await supabase.rpc(fn, args);
				if (error) {
					setMessage(error.message);
					return;
				}
			}
			router.refresh();
		});
	}

	const primaryItems = sortPrimary(items, introductionMatchIds);
	const secondaryItems = items.filter((item) => SECONDARY_ORDER.includes(item.item_kind));
	const attention =
		summary.candidate_matches + summary.qualified_matches + summary.pending_introductions;

	function actionsFor(item: RadarItem) {
		const matchId = matchIdFor(item, introductionMatchIds);
		if (item.item_kind === "candidate_match" && matchId) {
			return (
				<div className="mt-3">
					<button
						type="button"
						data-testid="radar-action-qualify"
						disabled={pending}
						onClick={() => runRpc("qualify_business_match", { p_match_id: matchId })}
						className={primaryAction}
					>
						{pending ? c.working : c.qualify}
					</button>
				</div>
			);
		}
		if (item.item_kind === "pending_introduction") {
			return (
				<p className="mt-3 rounded-lg bg-harvest-50 px-3 py-2 text-[13px] leading-snug text-harvest-700">
					{c.waiting}
				</p>
			);
		}
		if (item.item_kind === "qualified_match" && matchId) {
			return (
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						data-testid="radar-action-request"
						disabled={pending}
						onClick={() =>
							runRpc("request_business_match_introduction", { p_match_id: matchId, p_note: "" })
						}
						className={primaryAction}
					>
						{pending ? c.working : c.request}
					</button>
					<button
						type="button"
						data-testid="radar-action-accept"
						disabled={pending}
						onClick={() =>
							runRpc("respond_business_match_introduction", {
								p_match_id: matchId,
								p_accept: true,
								p_note: "",
							})
						}
						className={secondaryAction}
					>
						{c.accept}
					</button>
					<button
						type="button"
						data-testid="radar-action-decline"
						disabled={pending}
						onClick={() =>
							runRpc("respond_business_match_introduction", {
								p_match_id: matchId,
								p_accept: false,
								p_note: "",
							})
						}
						className={quietAction}
					>
						{c.decline}
					</button>
				</div>
			);
		}
		if (item.item_kind === "open_opportunity") {
			return <p className="mt-3 text-[13px] capitalize text-ink/55">{item.status ?? "open"}</p>;
		}
		return null;
	}

	return (
		<div
			className={journeyPage}
			data-testid="business-radar-board"
			data-locale={productLocale(locale)}
			aria-busy={pending}
		>
			<h1 className={journeyTitle}>{c.title}</h1>
			<p className={journeyLead}>{c.lead}</p>
			{e2e ? (
				<p className="mt-3 font-mono text-xs text-ink/50" data-testid="radar-e2e-role">
					role {e2e.role}
				</p>
			) : null}
			{loadError ? (
				<p className={alertError} role="alert">
					{c.unavailable}
				</p>
			) : null}
			{message ? (
				<p className={alertError} data-testid="radar-message" role="alert">
					{message}
				</p>
			) : null}

			<p className={journeyFact} data-testid="radar-priority-line">
				<span className="font-semibold text-ink">{attention}</span> {c.needsAttention}
				<span className="text-ink/25" aria-hidden>
					·
				</span>
				{summary.active_relationships} {c.relationships}
				<span className="text-ink/25" aria-hidden>
					·
				</span>
				{summary.open_opportunities} {c.opportunities}
			</p>

			<section className="mt-9" data-testid="radar-section-primary">
				<h2 className={journeySectionTitle}>{c.primary}</h2>
				{primaryItems.length === 0 ? (
					<div className="mt-3">
						{hasActiveIntent ? (
							<p className={waitingPanel} data-testid="radar-waiting-state" role="status">
								{c.looking}
							</p>
						) : (
							<>
								<p className="text-[14px] text-ink/50">{c.emptyPrimary}</p>
								{e2e ? null : (
									<Link href="/dashboard/onboarding" className={`${primaryAction} mt-4`}>
										{c.startIntent}
									</Link>
								)}
							</>
						)}
					</div>
				) : (
					<ul className="mt-4 flex flex-col gap-4">
						{primaryItems.map((item) => (
							<RadarMatchCard
								key={`${item.item_kind}:${item.item_id}`}
								item={item}
								actions={actionsFor(item)}
								locale={locale}
							/>
						))}
					</ul>
				)}
			</section>

			<section className="mt-11" data-testid="radar-section-secondary">
				<h2 className={`${journeySectionTitle} text-ink/70`}>{c.secondary}</h2>
				{secondaryItems.length === 0 ? (
					<p className="mt-3 text-[14px] text-ink/40">{c.emptySecondary}</p>
				) : (
					<ul className="mt-4 flex flex-col gap-4">
						{secondaryItems.map((item) => (
							<RadarMatchCard
								key={`${item.item_kind}:${item.item_id}`}
								item={item}
								actions={actionsFor(item)}
								locale={locale}
							/>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
