import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const STEPS = [
	{
		slug: "market-data",
		title: "Market data",
		line: "Research starts from recorded market data. This is not a brokerage feed.",
	},
	{
		slug: "screening",
		title: "Screening",
		line: "Screening narrows instruments from that data. It does not place an order.",
	},
	{
		slug: "strategy-research",
		title: "Strategy research",
		line: "A strategy is researched against the data. It is not an execution instruction.",
	},
	{
		slug: "backtesting",
		title: "Backtesting",
		line: "Backtesting measures a strategy on past data. The result is not a live trading result.",
	},
	{
		slug: "paper-book",
		title: "Paper book",
		line: "The paper book is a simulated book. A figure here is not a live trading result.",
	},
] as const;

const CHAIN = STEPS.map((step) => ({
	label: step.title,
	href: `/finance-intelligence/${step.slug}`,
}));

type PageProps = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
	return STEPS.map((step) => ({ step: step.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	return { title: found?.title ?? "Finance Intelligence" };
}

export default async function FinanceStepPage({ params }: PageProps) {
	const { locale, step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	if (!found) notFound();
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title={found.title}
			chain={CHAIN}
			boundary={[found.line, "Research and paper execution — not brokerage."]}
		/>
	);
}
