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
	let reasonsByMatchId: Record<string, RadarReason[]> = {};
	if (matchIds.length > 0) {
		const { data: reasonRows } = await supabase
			.from("business_matches")
			.select("id, reasons")
			.in("id", matchIds);
		reasonsByMatchId = Object.fromEntries(
			(reasonRows ?? []).map((row: { id: string; reasons: unknown }) => [
				row.id,
				parseMatchReasons(row.reasons),
			]),
		);
	}
	const itemsWithReasons = attachMatchReasons(items, reasonsByMatchId, introductionMatchIds);

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
