import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const BOUNDARY = [
	"AI translates and validates the investment idea.",
	"AI does not decide execution.",
];

const STEPS = [
	{
		slug: "human-idea",
		title: "Human idea",
		lead: "A person writes the investment idea. The words stay the person's.",
		points: [
			{ label: "Source", detail: "A human statement." },
			{ label: "Hand-off", detail: "The statement is passed on as text." },
			{ label: "Limit", detail: "The text is not an order." },
		],
	},
	{
		slug: "specification",
		title: "Specification",
		lead: "The copilot turns a candidate into a specification, or rejects it.",
		points: [
			{ label: "Input", detail: "The human idea and a candidate document." },
			{ label: "Gaps", detail: "Missing fields are not invented." },
			{ label: "Limit", detail: "The specification does not run a backtest or place an order." },
		],
	},
	{
		slug: "validation",
		title: "Validation",
		lead: "The candidate is checked. An invalid specification is rejected.",
		points: [
			{ label: "Check", detail: "The document must be a strategy specification." },
			{ label: "Refusal", detail: "A candidate that asks to execute or go live is rejected." },
			{ label: "Limit", detail: "Validation does not decide execution." },
		],
	},
	{
		slug: "canonical-strategy",
		title: "Canonical strategy",
		lead: "A valid candidate becomes one canonical strategy, with a fixed identity.",
		points: [
			{ label: "Record", detail: "The accepted specification." },
			{ label: "Identity", detail: "A digest of that specification." },
			{ label: "Limit", detail: "The strategy does not run a backtest, open a paper book, or place an order." },
		],
	},
] as const;

const CHAIN = STEPS.map((step) => ({
	label: step.title,
	href: `/strategy-copilot/${step.slug}`,
}));

type PageProps = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
	return STEPS.map((step) => ({ step: step.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	return { title: found?.title ?? "AI Strategy Copilot" };
}

export default async function StrategyCopilotStepPage({ params }: PageProps) {
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
			current={`/strategy-copilot/${found.slug}`}
			points={[...found.points]}
			boundary={[...BOUNDARY]}
		/>
	);
}
