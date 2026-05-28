"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ThreePillars() {
	const t = useTranslations("Home");
	const pillars = [
		{ icon: "📡", title: t("pillar1Title"), desc: t("pillar1Desc") },
		{ icon: "🧠", title: t("pillar2Title"), desc: t("pillar2Desc") },
		{ icon: "⚡", title: t("pillar3Title"), desc: t("pillar3Desc") },
	];

	return (
		<section className="mx-auto grid max-w-3xl gap-3.5 px-8 py-12 md:grid-cols-3">
			{pillars.map((p) => (
				<div key={p.title} className="glass p-5">
					<div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-forest-700/10 to-harvest-500/10 text-lg text-forest-700">
						{p.icon}
					</div>
					<div className="mb-1 text-sm font-medium tracking-[-0.005em]">{p.title}</div>
					<div className="text-[12.5px] leading-[1.5] text-ink/55">{p.desc}</div>
				</div>
			))}
		</section>
	);
}

export function FarmerQuote() {
	const t = useTranslations("Home");
	return (
		<section className="mx-auto max-w-xl px-8 py-10 text-center">
			<p className="mb-2 font-serif text-lg font-normal leading-[1.45] tracking-[-0.005em] text-ink/85">
				{t("quoteScenarioLabel")}
			</p>
			<p className="text-xs text-ink/45">{t("quoteScenarioBody")}</p>
		</section>
	);
}

export function SponsorBand() {
	const t = useTranslations("Home");
	return (
		<section className="mx-auto max-w-3xl px-8 py-10">
			<div className="flex flex-col items-center gap-6 glass p-6 md:flex-row md:p-7">
				<div className="flex-1">
					<div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/45">
						{t("sponsorCode")}
					</div>
					<h3 className="mb-1.5 font-serif text-xl font-normal leading-[1.3] tracking-[-0.015em]">
						{t("sponsorTitleBefore")}
						<em className="grad-text">{t("sponsorTitleEm")}</em>
					</h3>
					<p className="text-[12.5px] leading-[1.5] text-ink/60">{t("sponsorBody")}</p>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-2">
					<Link
						href="/sponsors"
						className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-ink/90"
					>
						{t("sponsorCta1")}
					</Link>
					<Link
						href="/sponsors#advertise"
						className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-ink/25 bg-transparent px-5 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.03]"
					>
						{t("sponsorCta2")}
					</Link>
				</div>
			</div>
		</section>
	);
}

export function FinalCTA() {
	const t = useTranslations("Home");
	const titleLines = t("finalTitle").split("\n");
	return (
		<section className="mx-auto max-w-3xl px-8 py-14 text-center">
			<h2 className="mb-3 bg-gradient-to-br from-ink via-ink/80 to-forest-700 bg-clip-text font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em] text-transparent">
				{titleLines.map((line, i) => (
					<span key={i}>
						{i > 0 && <br />}
						{line}
					</span>
				))}
			</h2>
			<p className="mb-6 text-sm text-ink/55">{t("finalSubtitle")}</p>
			<div className="inline-flex flex-wrap items-center justify-center gap-2.5">
				<Link
					href="/dashboard"
					className="inline-flex items-center gap-1.5 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-white shadow-[0_6px_18px_rgba(10,10,10,0.2)] transition-colors hover:bg-ink/90"
				>
					{t("finalCtaDash")}
				</Link>
				<Link
					href="/academy"
					className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/75 px-6 py-3 text-[13px] font-medium text-ink backdrop-blur-xl transition-colors hover:bg-white/90"
				>
					{t("finalCtaAcademy")}
				</Link>
			</div>
		</section>
	);
}
