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
			chain={[
				{ label: "Market data", href: "/finance-intelligence/market-data" },
				{ label: "Screening", href: "/finance-intelligence/screening" },
				{ label: "Strategy research", href: "/finance-intelligence/strategy-research" },
				{ label: "Backtesting", href: "/finance-intelligence/backtesting" },
				{ label: "Paper book", href: "/finance-intelligence/paper-book" },
			]}
			boundary={["Research and paper execution — not brokerage."]}
		/>
	);
}
