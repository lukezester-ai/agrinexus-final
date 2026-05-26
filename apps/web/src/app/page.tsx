import { Hero } from "@/components/Hero";
import { CTA, CTARow } from "@/components/CTA";
import { TerminalDemo } from "@/components/home/TerminalDemo";
import { ThreePillars, FarmerQuote, SponsorBand, FinalCTA } from "@/components/home/parts";

export default function HomePage() {
	return (
		<>
			<Hero
				title={
					<>
						From soil to <em className="grad-text not-italic [font-style:italic]">market.</em>
						<br />
						For every farmer.
					</>
				}
				subtitle="AgriNexus is the open intelligence layer for modern farming — satellites, agents, commodity insight. Free for every farmer, anywhere."
			>
				<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-ink/[0.07] bg-white/65 py-1.5 pl-1.5 pr-3 text-[11px] text-ink/70 backdrop-blur-xl">
					<span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-medium text-white">
						Free forever
					</span>
					<span>Built for farmers, funded by sponsors</span>
				</div>
				<CTARow>
					<CTA href="/dashboard">Start free →</CTA>
					<CTA href="#demo" variant="secondary">
						▶ Watch demo
					</CTA>
				</CTARow>
				<div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-ink/[0.07] bg-white/55 px-4 py-2 text-xs text-ink/65 backdrop-blur-xl">
					<span className="h-2 w-2 rounded-full bg-brand-gradient" />
					<span>
						<strong className="font-medium text-ink">100% free</strong> · No ads · No data sold · No paywall · Forever
					</span>
				</div>
			</Hero>

			<TerminalDemo />
			<ThreePillars />
			<FarmerQuote />
			<SponsorBand />
			<FinalCTA />
		</>
	);
}
