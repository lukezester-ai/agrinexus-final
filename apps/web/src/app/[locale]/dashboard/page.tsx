import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { BusinessRadarBoard } from "@/components/Dashboard/BusinessRadarBoard";
import {
	EMPTY_RADAR_SUMMARY,
	attachMatchReasons,
	parseMatchReasons,
	parseRadarSummary,
	type RadarItem,
	type RadarReason,
} from "@/lib/business-radar";
import { radarBoardCopy, productLocale } from "@/lib/product-ux-copy";
import { NO_MATCH_CAPABILITIES, parseMatchCapabilities } from "@/lib/match-capabilities";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	const c = radarBoardCopy[productLocale(locale)];
	return { title: c.title, description: c.metaDescription };
}

export default async function DashboardPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();

	const [{ data: summaryRows, error: summaryError }, { data: itemRows, error: itemsError }] =
		await Promise.all([
			supabase.rpc("business_radar_summary"),
			supabase.from("business_radar_items").select("*").order("updated_at", { ascending: false }),
		]);

	const summary = parseRadarSummary(Array.isArray(summaryRows) ? summaryRows[0] : summaryRows);
	const items = (itemRows ?? []) as RadarItem[];
	const pendingIds = items
		.filter((item) => item.item_kind === "pending_introduction")
		.map((item) => item.item_id);

	let introductionMatchIds: Record<string, string> = {};
	if (pendingIds.length > 0) {
		const { data: intros } = await supabase
			.from("business_match_introductions")
			.select("id, match_id")
			.in("id", pendingIds);
		introductionMatchIds = Object.fromEntries(
			(intros ?? []).map((row: { id: string; match_id: string }) => [row.id, row.match_id]),
		);
	}

	const matchIds = [
		...items
			.filter((item) => item.item_kind === "candidate_match" || item.item_kind === "qualified_match")
			.map((item) => item.item_id),
		...Object.values(introductionMatchIds),
	];
	const relationshipItems = items.filter((item) => item.item_kind === "relationship");
	const relationshipMatchIds: Record<string, string> = {};
	if (relationshipItems.length > 0) {
		const { data: relationships } = await supabase
			.from("business_relationships")
			.select("id, origin_match_id")
			.in("id", relationshipItems.map((item) => item.item_id));
		Object.assign(
			relationshipMatchIds,
			Object.fromEntries((relationships ?? []).map((row: { id: string; origin_match_id: string }) => [row.id, row.origin_match_id])),
		);
		matchIds.push(...Object.values(relationshipMatchIds));
	}
	let reasonsByMatchId: Record<string, RadarReason[]> = {};
	let capabilitiesByMatchId = {} as ReturnType<typeof parseMatchCapabilities>;
	if (matchIds.length > 0) {
		const [{ data: reasonRows }, { data: capabilityRows }] = await Promise.all([
			supabase.from("business_matches").select("id, reasons").in("id", matchIds),
			supabase.rpc("business_match_capabilities", { p_match_ids: matchIds }),
		]);
		reasonsByMatchId = Object.fromEntries(
			(reasonRows ?? []).map((row: { id: string; reasons: unknown }) => [
				row.id,
				parseMatchReasons(row.reasons),
			]),
		);
		capabilitiesByMatchId = parseMatchCapabilities(capabilityRows);
	}
	const itemsWithReasons = attachMatchReasons(items, reasonsByMatchId, introductionMatchIds).map((item) => {
		const matchId = item.item_kind === "pending_introduction"
			? introductionMatchIds[item.item_id]
			: item.item_kind === "candidate_match" || item.item_kind === "qualified_match"
				? item.item_id
				: null;
		const effectiveMatchId = matchId ?? (item.item_kind === "relationship" ? relationshipMatchIds[item.item_id] : null);
		return effectiveMatchId ? { ...item, capabilities: capabilitiesByMatchId[effectiveMatchId] ?? NO_MATCH_CAPABILITIES } : item;
	});

	const { count: activeIntentCount } = await supabase
		.from("business_intents")
		.select("id", { count: "exact", head: true })
		.eq("lifecycle", "active");

	const loadError = summaryError?.message || itemsError?.message || null;

	return (
		<BusinessRadarBoard
			locale={locale}
			summary={loadError ? EMPTY_RADAR_SUMMARY : summary}
			items={loadError ? [] : itemsWithReasons}
			introductionMatchIds={introductionMatchIds}
			loadError={loadError}
			hasActiveIntent={(activeIntentCount ?? 0) > 0}
		/>
	);
}
