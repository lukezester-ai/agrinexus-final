import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const BOUNDARY = "Research and paper execution — not brokerage.";

const STEPS = [
	{
		slug: "market-data",
		title: "Market data",
		lead: "Research starts from a recorded bar. The bar is stored data, not a brokerage stream.",
		points: [
			{ label: "Record", detail: "Time, open, high, low, close, and volume." },
			{ label: "Use", detail: "Later steps read this record. They do not replace it with a live quote." },
			{ label: "Limit", detail: "This is not a brokerage feed." },
		],
	},
	{
		slug: "screening",
		title: "Screening",
		lead: "Screening narrows symbols from the recorded bars. A candidate is not an order.",
		points: [
			{ label: "Reads", detail: "Exchange, symbol, close, and volume." },
			{ label: "Returns", detail: "A shorter candidate list and a digest of that screen." },
			{ label: "Limit", detail: "Nothing on this page is sent." },
		],
	},
	{
		slug: "strategy-research",
		title: "Strategy research",
		lead: "A strategy is a written entry and exit rule, checked against the recorded bars.",
		points: [
			{ label: "Entry", detail: "The conditions that would open a simulated position." },
			{ label: "Exit", detail: "The conditions that would close it." },
			{ label: "Limit", detail: "The rule is research. It is not an execution instruction." },
		],
	},
	{
		slug: "backtesting",
		title: "Backtesting",
		lead: "Backtesting runs the rule on past bars. The result stays inside the test.",
		points: [
			{ label: "Paper fill", detail: "A simulated fill on that history: bar, side, price, and quantity." },
			{ label: "Measure", detail: "The test records what the rule would have done on past data." },
			{ label: "Limit", detail: "The result is not a live trading result." },
		],
	},
	{
		slug: "paper-book",
		title: "Paper book",
		lead: "The paper book is the simulated ledger of that research. Figures here belong only to the simulation.",
		points: [
			{ label: "Ledger", detail: "Simulated entries and exits, with price and quantity." },
			{ label: "Drawdown", detail: "The decline of the simulated equity from its peak." },
			{ label: "Performance", detail: "Return, win rate, and related figures of the paper book." },
			{ label: "Limit", detail: "A figure here is not a live trading result." },
		],
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
			lead={found.lead}
			chain={CHAIN}
			current={`/finance-intelligence/${found.slug}`}
			points={[...found.points]}
			boundary={[BOUNDARY]}
		/>
	);
}
