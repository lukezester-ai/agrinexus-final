import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "Business Radar" };

export default async function BusinessRadarPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="Business Radar"
			chain={[
				{ label: "Intent", href: "/dashboard/intents" },
				{ label: "Matching", href: "/dashboard/opportunities" },
				{ label: "Radar", href: "/dashboard" },
				{ label: "Introduction", href: "/dashboard" },
				{ label: "Relationship", href: "/dashboard" },
			]}
			boundary={["A match is criteria alignment. It is not a closed deal.", "Confidential identity stays hidden until both sides agree to an introduction."]}
		/>
	);
}
