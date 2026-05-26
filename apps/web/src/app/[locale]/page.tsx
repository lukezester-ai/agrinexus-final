import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/Hero";
import { CTA, CTARow } from "@/components/CTA";
import { TerminalDemo } from "@/components/home/TerminalDemo";
import { ThreePillars, FarmerQuote, SponsorBand, FinalCTA } from "@/components/home/parts";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("Home");

	return (
		<>
			<Hero
				title={
					<>
						{t("heroLine1")}{" "}
						<em className="grad-text not-italic [font-style:italic]">{t("heroEm")}</em>
						<br />
						{t("heroLine2")}
					</>
				}
				subtitle={t("subtitle")}
			>
				<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-ink/[0.07] bg-white/65 py-1.5 pl-1.5 pr-3 text-[11px] text-ink/70 backdrop-blur-xl">
					<span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-medium text-white">
						{t("badgeFree")}
					</span>
					<span>{t("badgeFunded")}</span>
				</div>
				<CTARow>
					<CTA href="/dashboard">{t("ctaStart")}</CTA>
					<CTA href="#demo" variant="secondary">
						{t("ctaDemo")}
					</CTA>
				</CTARow>
				<div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-ink/[0.07] bg-white/55 px-4 py-2 text-xs text-ink/65 backdrop-blur-xl">
					<span className="h-2 w-2 rounded-full bg-brand-gradient" />
					<span>
						<strong className="font-medium text-ink">{t("trustStrong")}</strong> {t("trustRest")}
					</span>
				</div>
			</Hero>

			<TerminalDemo locale={locale} />
			<ThreePillars />
			<FarmerQuote />
			<SponsorBand />
			<FinalCTA />
		</>
	);
}
