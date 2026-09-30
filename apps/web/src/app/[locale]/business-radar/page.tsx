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
			chain={["Intent", "Matching", "Radar", "Introduction", "Relationship"]}
			boundary={["A match is criteria alignment. It is not a closed deal.", "Confidential identity stays hidden until both sides agree to an introduction."]}
		/>
	);
}
