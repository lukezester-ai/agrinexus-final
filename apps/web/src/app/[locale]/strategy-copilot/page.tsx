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
			chain={[
				{ label: "Human idea", href: "/strategy-copilot/human-idea" },
				{ label: "Specification", href: "/strategy-copilot/specification" },
				{ label: "Validation", href: "/strategy-copilot/validation" },
				{ label: "Canonical strategy", href: "/strategy-copilot/canonical-strategy" },
			]}
			boundary={["AI translates and validates the investment idea.", "AI does not decide execution."]}
		/>
	);
}
