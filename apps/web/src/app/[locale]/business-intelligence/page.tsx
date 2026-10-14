import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "Business Intelligence" };

export default async function BusinessIntelligencePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="Business Intelligence"
			lead="Business intelligence is the decision layer. A business intent splits here into a match or into research."
			chain={[
				{ label: "Business Radar", href: "/business-radar" },
				{ label: "Finance Intelligence", href: "/finance-intelligence" },
			]}
			points={[
				{ label: "Radar", detail: "Matches one business with another. A match is criteria alignment." },
				{ label: "Finance", detail: "Researches a strategy on recorded data and a paper book." },
				{ label: "Limit", detail: "This layer does not run an agent team and does not send an order." },
			]}
			boundary={["From business intent to a governed decision."]}
		/>
	);
}
