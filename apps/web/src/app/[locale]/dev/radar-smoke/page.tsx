import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BusinessRadarBoard } from "@/components/Dashboard/BusinessRadarBoard";
import { EMPTY_RADAR_SUMMARY } from "@/lib/business-radar";
import {
	assertRadarE2ESecret,
	isRadarE2EEnabled,
	loadRadarForRole,
	parseRadarE2ERole,
} from "@/lib/radar-e2e";

export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ role?: string; secret?: string }>;
};

export default async function RadarSmokePage({ params, searchParams }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	if (!isRadarE2EEnabled()) notFound();
	const query = await searchParams;
	if (!assertRadarE2ESecret(query.secret)) notFound();
	const role = parseRadarE2ERole(query.role);
	if (!role) notFound();

	let loadError: string | null = null;
	let summary = EMPTY_RADAR_SUMMARY;
	let items: Awaited<ReturnType<typeof loadRadarForRole>>["items"] = [];
	let introductionMatchIds: Record<string, string> = {};
	try {
		const loaded = await loadRadarForRole(role);
		summary = loaded.summary;
		items = loaded.items;
		introductionMatchIds = loaded.introductionMatchIds;
	} catch (error) {
		loadError = error instanceof Error ? error.message : "radar load failed";
	}

	return (
		<BusinessRadarBoard
			locale={locale}
			summary={summary}
			items={items}
			introductionMatchIds={introductionMatchIds}
			loadError={loadError}
			e2e={{ role, secret: query.secret ?? "" }}
		/>
	);
}
