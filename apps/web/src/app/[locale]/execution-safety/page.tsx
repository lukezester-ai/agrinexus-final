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
			chain={[
				{ label: "Authorization", href: "/execution-safety/authorization" },
				{ label: "Safety controls", href: "/execution-safety/safety-controls" },
				{ label: "Dispatch contract", href: "/execution-safety/dispatch-contract" },
				{ label: "External result", href: "/execution-safety/external-result" },
				{ label: "Reconciliation", href: "/execution-safety/reconciliation" },
				{ label: "STOP", href: "/execution-safety/stop" },
			]}
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
