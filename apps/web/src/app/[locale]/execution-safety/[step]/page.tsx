import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const BOUNDARY = [
	"No broker connection.",
	"No production credentials.",
	"No live order transmission.",
	"An observed external result is not a sent order.",
];

const STEPS = [
	{
		slug: "authorization",
		title: "Authorization",
		lead: "Authorization admits one intent a person already approved.",
		points: [
			{ label: "Admits", detail: "One approved intent." },
			{ label: "Identity", detail: "The authorization is tied to that intent and its evaluation." },
			{ label: "Limit", detail: "No order is transmitted." },
		],
	},
	{
		slug: "safety-controls",
		title: "Safety controls",
		lead: "Safety controls sit on one authorization.",
		points: [
			{ label: "Scope", detail: "One authorization." },
			{ label: "Controls", detail: "Order count, exposure, retries, and timeout stay inside the control." },
			{ label: "Limit", detail: "The controls do not open a broker connection." },
		],
	},
	{
		slug: "dispatch-contract",
		title: "Dispatch contract",
		lead: "The dispatch contract is the written terms for one admitted authorization.",
		points: [
			{ label: "Binds", detail: "The authorization, the intent, and the instrument." },
			{ label: "State", detail: "A contract on record." },
			{ label: "Limit", detail: "No live order transmission." },
		],
	},
	{
		slug: "external-result",
		title: "External result",
		lead: "An external result is an observation that was recorded.",
		points: [
			{ label: "Observation", detail: "What was seen is written down." },
			{ label: "Unresolved", detail: "A timeout, a missing result, or an invalid result stays unresolved." },
			{ label: "Limit", detail: "An observed external result is not a sent order." },
		],
	},
	{
		slug: "reconciliation",
		title: "Reconciliation",
		lead: "Reconciliation compares a stored outcome with its contract.",
		points: [
			{ label: "Compares", detail: "The stored outcome and the contract." },
			{ label: "Result", detail: "The comparison stays on record." },
			{ label: "Limit", detail: "The comparison does not transmit an order." },
		],
	},
	{
		slug: "stop",
		title: "STOP",
		lead: "The chain stops here. Live execution stays blocked.",
		points: [
			{ label: "State", detail: "LIVE EXECUTION: BLOCKED." },
			{ label: "Closed", detail: "No broker connection. No production credentials. No live order transmission." },
			{ label: "Limit", detail: "An observed external result is not a sent order." },
		],
	},
] as const;

const CHAIN = STEPS.map((step) => ({
	label: step.title,
	href: `/execution-safety/${step.slug}`,
}));

type PageProps = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
	return STEPS.map((step) => ({ step: step.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	return { title: found?.title ?? "Execution Safety" };
}

export default async function ExecutionSafetyStepPage({ params }: PageProps) {
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
			current={`/execution-safety/${found.slug}`}
			points={[...found.points]}
			boundary={[...BOUNDARY]}
		/>
	);
}
