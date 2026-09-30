import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "Execution Safety" };

export default async function ExecutionSafetyPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="Execution Safety"
			chain={["Authorization", "Safety controls", "Dispatch contract", "External result", "Reconciliation", "STOP"]}
			boundary={[
				"LIVE EXECUTION: BLOCKED",
				"No broker connection.",
				"No production credentials.",
				"No live order transmission.",
				"An observed external result is not a sent order.",
			]}
		/>
	);
}
