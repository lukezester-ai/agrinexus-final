import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DirectionPage } from "@/components/public/public-site";

export const metadata: Metadata = { title: "AI Strategy Copilot" };

export default async function StrategyCopilotPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return (
		<DirectionPage
			locale={locale}
			kicker="AGRI NEXUS"
			title="AI Strategy Copilot"
			chain={["Human idea", "Specification", "Validation", "Canonical strategy"]}
			boundary={["AI translates and validates the investment idea.", "AI does not decide execution."]}
		/>
	);
}
