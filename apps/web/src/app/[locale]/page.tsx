import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Hero } from "@/components/Hero";
import { CTA, CTARow } from "@/components/CTA";
import { cutoverCopy, productLocale } from "@/lib/product-ux-copy";
import { WORKING_PRODUCT_NAME } from "@/lib/product-identity";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = cutoverCopy[productLocale(locale)];

	return (
		<>
			<Hero
				title={
					<>
						{c.heroLine1}{" "}
						<em className="grad-text not-italic [font-style:italic]">{c.heroEm}</em>
						<br />
						{c.heroLine2}
					</>
				}
				subtitle={c.subtitle}
			>
				<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-ink/[0.07] bg-white/65 py-1.5 pl-1.5 pr-3 text-[11px] text-ink/70 backdrop-blur-xl">
					<span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-medium text-white">
						{c.badge}
					</span>
					<span>{WORKING_PRODUCT_NAME}</span>
				</div>
				<CTARow>
					<CTA href="/dashboard/onboarding">{c.ctaIntent}</CTA>
					<CTA href="/dashboard" variant="secondary">
						{c.ctaRadar}
					</CTA>
				</CTARow>
			</Hero>

			<section id="journey" className="mx-auto max-w-2xl px-8 py-8">
				<p className="mb-6 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">{c.stepKicker}</p>
				<ol className="flex flex-col gap-4">
					{c.steps.map((step, i) => (
						<li key={step.title} className="glass p-5">
							<div className="mb-1 font-mono text-[10px] tabular-nums text-ink/40">{String(i + 1).padStart(2, "0")}</div>
							<div className="mb-1 text-sm font-medium tracking-[-0.005em]">{step.title}</div>
							<div className="text-[12.5px] leading-[1.5] text-ink/55">{step.body}</div>
						</li>
					))}
				</ol>
			</section>

			<section className="mx-auto max-w-3xl px-8 py-14 text-center">
				<h2 className="mb-3 font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em] text-ink">{c.finalTitle}</h2>
				<p className="mb-6 text-sm text-ink/55">{c.finalSubtitle}</p>
				<div className="inline-flex flex-wrap items-center justify-center gap-2.5">
					<Link
						href="/dashboard/onboarding"
						className="inline-flex items-center gap-1.5 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-white shadow-[0_6px_18px_rgba(10,10,10,0.2)] transition-colors hover:bg-ink/90"
					>
						{c.ctaIntent}
					</Link>
					<Link
						href="/dashboard"
						className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/75 px-6 py-3 text-[13px] font-medium text-ink backdrop-blur-xl transition-colors hover:bg-white/90"
					>
						{c.ctaRadar}
					</Link>
				</div>
			</section>
		</>
	);
}
