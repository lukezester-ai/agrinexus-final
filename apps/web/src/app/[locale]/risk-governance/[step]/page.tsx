import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const BOUNDARY = ["This is a control layer. It is not a label on a trading engine."];

const STEPS = [
	{
		slug: "policy",
		title: "Policy",
		lead: "A risk policy is a stored control document.",
		points: [
			{ label: "Allows", detail: "The instruments and strategies named in the document." },
			{ label: "Forbids", detail: "The actions the document refuses." },
			{ label: "Limits", detail: "Exposure, drawdown, and position risk." },
			{ label: "Limit", detail: "The policy document does not evaluate a strategy by itself." },
		],
	},
	{
		slug: "evaluation",
		title: "Evaluation",
		lead: "Evaluation compares the stored policy with figures a book has already recorded.",
		points: [
			{ label: "Compares", detail: "Policy limits against recorded book metrics." },
			{ label: "Result", detail: "Accepted, or a list of denials." },
			{ label: "Limit", detail: "Evaluation does not send an order." },
		],
	},
	{
		slug: "human-approval",
		title: "Human approval",
		lead: "A person approves one intent. The approval is a record.",
		points: [
			{ label: "Who", detail: "A human." },
			{ label: "What", detail: "One intent, tied to the evaluation." },
			{ label: "Limit", detail: "The approval does not send an order." },
		],
	},
	{
		slug: "audit",
		title: "Audit",
		lead: "The audit keeps the record of the policy, the evaluation, and the approval.",
		points: [
			{ label: "Record", detail: "What was decided, and the identity of that decision." },
			{ label: "Use", detail: "Later safety steps read this record." },
			{ label: "Limit", detail: "The audit does not send an order." },
		],
	},
] as const;

const CHAIN = STEPS.map((step) => ({
	label: step.title,
	href: `/risk-governance/${step.slug}`,
}));

type PageProps = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
	return STEPS.map((step) => ({ step: step.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	return { title: found?.title ?? "Risk & Governance" };
}

export default async function RiskGovernanceStepPage({ params }: PageProps) {
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
			current={`/risk-governance/${found.slug}`}
			points={[...found.points]}
			boundary={[...BOUNDARY]}
		/>
	);
}
