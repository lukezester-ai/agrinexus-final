import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "Finance Intelligence" };

export default async function FinanceIntelligencePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="Finance Intelligence"
			chain={["Market data", "Screening", "Strategy research", "Backtesting", "Paper book"]}
			boundary={["Research and paper execution — not brokerage."]}
		/>
	);
}
