import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "Risk & Governance" };

export default async function RiskGovernancePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="Risk & Governance"
			chain={["Policy", "Evaluation", "Human approval", "Audit"]}
			boundary={["This is a control layer. It is not a label on a trading engine."]}
		/>
	);
}
