import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

const BOUNDARY = [
	"A match is criteria alignment. It is not a closed deal.",
	"Confidential identity stays hidden until both sides agree to an introduction.",
];

const STEPS = [
	{
		slug: "intent",
		title: "Intent",
		lead: "An intent is the business record of demand or supply.",
		points: [
			{ label: "Record", detail: "Type, industry, markets, visibility, lifecycle, and confidentiality." },
			{ label: "Next", detail: "Matching reads this record." },
			{ label: "Limit", detail: "An intent is not a closed deal." },
		],
		enter: { label: "Open intents", href: "/dashboard/intents" },
	},
	{
		slug: "matching",
		title: "Matching",
		lead: "Matching aligns an intent with an opportunity on the fields that were indexed.",
		points: [
			{ label: "Reads", detail: "Indexed fields only." },
			{ label: "Returns", detail: "A match and the reasons for it." },
			{ label: "Limit", detail: "A match is criteria alignment. It is not a score and it is not a closed deal." },
		],
		enter: { label: "Open opportunities", href: "/dashboard/opportunities" },
	},
	{
		slug: "radar",
		title: "Radar",
		lead: "The radar is the board of candidates, introductions, and relationships.",
		points: [
			{ label: "Candidates", detail: "Matches waiting for a decision." },
			{ label: "Introductions", detail: "Requests that still need an answer." },
			{ label: "Relationships", detail: "The shared places already opened." },
		],
		enter: { label: "Open the radar", href: "/dashboard" },
	},
	{
		slug: "introduction",
		title: "Introduction",
		lead: "An introduction is a request both sides answer before identity is shown.",
		points: [
			{ label: "Request", detail: "One side asks for an introduction on a match." },
			{ label: "Answer", detail: "The other side accepts or declines on the radar." },
			{ label: "Limit", detail: "Confidential identity stays hidden until both sides agree." },
		],
		enter: { label: "Open the radar", href: "/dashboard" },
	},
	{
		slug: "relationship",
		title: "Relationship",
		lead: "A relationship is the shared place after an introduction is accepted.",
		points: [
			{ label: "Place", detail: "State, activity, and the next useful action." },
			{ label: "Life", detail: "It can stay active, pause, or close. The history remains." },
			{ label: "Limit", detail: "A relationship is not created by the match alone." },
		],
		enter: { label: "Open the radar", href: "/dashboard" },
	},
] as const;

const CHAIN = STEPS.map((step) => ({
	label: step.title,
	href: `/business-radar/${step.slug}`,
}));

type PageProps = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
	return STEPS.map((step) => ({ step: step.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { step } = await params;
	const found = STEPS.find((item) => item.slug === step);
	return { title: found?.title ?? "Business Radar" };
}

export default async function BusinessRadarStepPage({ params }: PageProps) {
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
			current={`/business-radar/${found.slug}`}
			points={[...found.points]}
			enter={found.enter}
			boundary={[...BOUNDARY]}
		/>
	);
}
