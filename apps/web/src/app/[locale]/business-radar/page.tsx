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
				{ label: "Intent", href: "/business-radar/intent" },
				{ label: "Matching", href: "/business-radar/matching" },
				{ label: "Radar", href: "/business-radar/radar" },
				{ label: "Introduction", href: "/business-radar/introduction" },
				{ label: "Relationship", href: "/business-radar/relationship" },
			]}
			boundary={["A match is criteria alignment. It is not a closed deal.", "Confidential identity stays hidden until both sides agree to an introduction."]}
		/>
	);
}
