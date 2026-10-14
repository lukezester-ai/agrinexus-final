import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { CTA, CTARow } from "@/components/CTA";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Спонсорство и реклама",
				description:
					"Три начина да подкрепиш фермерите: Seed, Harvest, Foundation. Спонсорството никога не влияе върху препоръките на агентите.",
			}
		: {
				title: "Sponsorship & advertising",
				description:
					"Three ways to stand with farmers: Seed, Harvest, Foundation. Sponsorship never influences agent recommendations.",
			};
}

const copy = {
	en: {
		heroEyebrow: "// Sponsors & advertise",
		heroLine1: "Free for farmers,",
		heroLine2Before: "because of ",
		heroLine2Em: "you.",
		heroSubtitle:
			"AgriNexus stays open because companies, foundations and brands choose to fund it. Three ways to stand with farmers — pick the one that fits.",
		tiersCta: "See sponsorship tiers →",
		adsCta: "Advertise with us",
		mostChosen: "MOST CHOSEN",
		tiersHeader: {
			eyebrow: "Sponsorship tiers",
			titleBefore: "Three ways to ",
			titleEm: "stand with farmers.",
			subtitle:
				"Every tier funds farmer access directly. Sponsor presence is visible, trackable, and never influences agent recommendations.",
		},
		wallHeader: {
			eyebrow: "Already on board",
			titleBefore: "Who already ",
			titleEm: "stands with us.",
			subtitle: "A growing coalition across agriculture, finance and food security. Your name belongs here next.",
		},
		adsHeader: {
			eyebrow: "Native advertising",
			titleBefore: "Reach the farmer ",
			titleEm: "at the moment of decision.",
			subtitle:
				"Targeted by crop, region, season. Always clearly labeled as sponsored. Never affects what the agents recommend.",
		},
		faqHeader: { eyebrow: "// Common questions", titleBefore: "Answered ", titleEm: "upfront." },
		finalLine1: "Will you be the reason",
		finalEm: "a farm grows?",
		finalSub: "One conversation. We'll find the right fit.",
		finalCta1: "Book a 30-min intro call →",
		finalCta2: "Download the brief PDF",
		tiers: [
			{
				name: "Seed",
				forWhom: "Startups & regional brands",
				price: "€500",
				unit: "/ month · annual commit",
				perks: ["Logo on Sponsors page", "Quarterly impact report", "Newsletter mention", "Annual recognition post"],
				impact: "Funds ~10 farms / month",
				cta: "Become a Seed sponsor",
				featured: false,
			},
			{
				name: "Harvest",
				forWhom: "Agritech & banking partners",
				price: "€2,500",
				unit: "/ month · annual commit",
				perks: ["Featured logo + landing badge", "Co-branded research reports", "Anonymized dataset access", "Co-hosted farmer webinars", "Dedicated account manager"],
				impact: "Funds ~60 farms / month",
				cta: "Become a Harvest partner",
				featured: true,
			},
			{
				name: "Foundation",
				forWhom: "Governments & NGOs",
				price: "Custom",
				unit: "strategic partnership",
				perks: ["Named agent or region", "Strategic advisory seat", "Custom ESG / CSR reports", "Joint press & field programs", "White-paper co-authorship"],
				impact: "Funds entire countries",
				cta: "Open a conversation",
				featured: false,
			},
		],
		wallTiers: [
			{ label: "Foundation partners", size: "text-xl", color: "text-ink", logos: ["Gates Foundation", "FAO", "European Commission"] },
			{ label: "Harvest sponsors", size: "text-base", color: "text-ink", logos: ["Syngenta", "Rabobank", "Bayer", "DSM"] },
			{ label: "Seed sponsors", size: "text-[13px]", color: "text-ink/65", logos: ["John Deere", "UniCredit", "Yara", "Trimble", "Claas", "+ 19 more"] },
		],
		ads: [
			{ icon: "📩", name: "Daily Briefing slot", desc: "A native card in the morning briefing — relevant to crop, season, and recent agent activity. Read by 89% of active users.", specs: ["CPM €18", "Native format", "Crop-targeted"] },
			{ icon: "📊", name: "Dashboard banner", desc: "A subtle placement on the main dashboard, rotating across sponsors. High visibility, low intrusion.", specs: ["CPM €12", "Geo-targeted", "Rotated"] },
			{ icon: "🎙️", name: "Podcast sponsorship", desc: "Host-read messages in The Field Notes podcast. 42k listeners, 38-minute average completion.", specs: ["From €2k / ep", "Host-read", "14-day exclusivity"] },
			{ icon: "📚", name: "Academy article sponsor", desc: '"Brought to you by" credit on a learning path or single article. No content control.', specs: ["From €800 / article", "Permanent"] },
		],
		faqs: [
			{
				q: "Does sponsorship influence which agents recommend what?",
				a: "No, ever. There's a hard wall between sponsorship and agent reasoning. Every recommendation carries its data sources, and they're always agronomic or financial — never commercial.",
			},
			{
				q: "What data is shared with sponsors?",
				a: "Only aggregated, anonymized insights. Never personal farm data, never named farmers. Sponsors at Harvest tier and above get full data documentation.",
			},
			{
				q: "How is impact measured and reported?",
				a: "Quarterly impact reports per sponsor, with farms supported, hectares monitored, yield gained, and CO2 avoided.",
			},
			{
				q: "Can I sponsor a specific region or crop?",
				a: 'Yes, especially at the Harvest and Foundation tiers. A common pattern: "Sponsor 100 wheat farms in Bulgaria for one year."',
			},
		],
	},
	bg: {
		heroEyebrow: "// Спонсори и реклама",
		heroLine1: "Безплатно за фермерите,",
		heroLine2Before: "благодарение на ",
		heroLine2Em: "теб.",
		heroSubtitle:
			"AgriNexus остава отворен, защото компании, фондации и марки избират да го финансират. Има три начина да застанеш до фермерите — избери този, който пасва.",
		tiersCta: "Виж нивата на спонсорство →",
		adsCta: "Рекламирай с нас",
		mostChosen: "НАЙ-ИЗБИРАНО",
		tiersHeader: {
			eyebrow: "Нива на спонсорство",
			titleBefore: "Три начина да ",
			titleEm: "подкрепиш фермерите.",
			subtitle:
				"Всяко ниво финансира достъпа на фермери директно. Присъствието на спонсора е видимо и измеримо, но никога не влияе върху препоръките на агентите.",
		},
		wallHeader: {
			eyebrow: "Вече с нас",
			titleBefore: "Кой вече ",
			titleEm: "стои до нас.",
			subtitle: "Растяща общност от земеделие, финанси и продоволствена сигурност. Твоето име може да е следващото.",
		},
		adsHeader: {
			eyebrow: "Нативна реклама",
			titleBefore: "Достигни фермера ",
			titleEm: "в момента на решение.",
			subtitle:
				"Таргетирано по култура, регион и сезон. Винаги ясно означено като спонсорирано. Никога не влияе върху препоръките на агентите.",
		},
		faqHeader: { eyebrow: "// Често задавани въпроси", titleBefore: "Отговори ", titleEm: "предварително." },
		finalLine1: "Ще бъдеш ли причината",
		finalEm: "една ферма да расте?",
		finalSub: "Един разговор. Ще намерим правилния формат.",
		finalCta1: "Запази 30-минутен разговор →",
		finalCta2: "Изтегли краткия PDF",
		tiers: [
			{
				name: "Seed",
				forWhom: "Стартъпи и регионални марки",
				price: "€500",
				unit: "/ месец · годишен ангажимент",
				perks: ["Лого на страницата със спонсори", "Тримесечен impact отчет", "Споменаване в бюлетин", "Годишно признание"],
				impact: "Финансира ~10 ферми / месец",
				cta: "Стани Seed спонсор",
				featured: false,
			},
			{
				name: "Harvest",
				forWhom: "Агротех и банкови партньори",
				price: "€2,500",
				unit: "/ месец · годишен ангажимент",
				perks: ["Видимо лого + badge", "Съвместни research отчети", "Анонимизиран достъп до данни", "Съвместни уебинари за фермери", "Личен account manager"],
				impact: "Финансира ~60 ферми / месец",
				cta: "Стани Harvest партньор",
				featured: true,
			},
			{
				name: "Foundation",
				forWhom: "Държави и неправителствени организации",
				price: "По заявка",
				unit: "стратегическо партньорство",
				perks: ["Именуван агент или регион", "Място в стратегически съвет", "Персонални ESG / CSR отчети", "Съвместни програми на терен", "Съавторство на white paper"],
				impact: "Финансира цели държави",
				cta: "Започни разговор",
				featured: false,
			},
		],
		wallTiers: [
			{ label: "Foundation партньори", size: "text-xl", color: "text-ink", logos: ["Gates Foundation", "FAO", "European Commission"] },
			{ label: "Harvest спонсори", size: "text-base", color: "text-ink", logos: ["Syngenta", "Rabobank", "Bayer", "DSM"] },
			{ label: "Seed спонсори", size: "text-[13px]", color: "text-ink/65", logos: ["John Deere", "UniCredit", "Yara", "Trimble", "Claas", "+ още 19"] },
		],
		ads: [
			{ icon: "📩", name: "Място в дневния briefing", desc: "Нативна карта в сутрешния обзор — релевантна към културата, сезона и последната активност на агентите.", specs: ["CPM €18", "нативен формат", "по култури"] },
			{ icon: "📊", name: "Банер в таблото", desc: "Дискретно място в основното табло, ротирано между спонсори. Видимо, но ненатрапчиво.", specs: ["CPM €12", "гео таргет", "ротация"] },
			{ icon: "🎙️", name: "Спонсорство на подкаст", desc: "Съобщения, прочетени от водещия в The Field Notes. 42k слушатели и висока завършеност.", specs: ["от €2k / еп.", "host-read", "14 дни ексклузивност"] },
			{ icon: "📚", name: "Спонсор на статия в Академията", desc: 'Кредит "С подкрепата на" върху учебна пътека или статия. Без контрол върху съдържанието.', specs: ["от €800 / статия", "постоянно"] },
		],
		faqs: [
			{
				q: "Влияе ли спонсорството върху препоръките на агентите?",
				a: "Не. Има твърда граница между спонсорство и reasoning на агентите. Всяка препоръка се базира на агрономични или финансови данни, не на търговски интерес.",
			},
			{
				q: "Какви данни се споделят със спонсорите?",
				a: "Само агрегирани и анонимизирани обобщения. Никога лични данни за ферми, никога именувани фермери.",
			},
			{
				q: "Как се измерва ефектът?",
				a: "С тримесечни impact отчети: подкрепени ферми, наблюдавани хектари, подобрен добив и избегнати CO2 емисии.",
			},
			{
				q: "Мога ли да спонсорирам конкретен регион или култура?",
				a: 'Да, особено при Harvest и Foundation. Например: "Подкрепи 100 пшенични ферми в България за една година."',
			},
		],
	},
};

export default async function SponsorsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<>
			<Hero
				eyebrow={c.heroEyebrow}
				title={
					<>
						{c.heroLine1}
						<br />
						{c.heroLine2Before}
						<em className="grad-text not-italic [font-style:italic]">{c.heroLine2Em}</em>
					</>
				}
				subtitle={c.heroSubtitle}
			>
				<CTARow>
					<CTA href="#tiers">{c.tiersCta}</CTA>
					<CTA href="#advertise" variant="secondary">{c.adsCta}</CTA>
				</CTARow>
			</Hero>

			<div id="tiers">
				<SectionHeader
					num="01"
					eyebrow={c.tiersHeader.eyebrow}
					title={
						<>
							{c.tiersHeader.titleBefore}
							<em className="grad-text">{c.tiersHeader.titleEm}</em>
						</>
					}
					subtitle={c.tiersHeader.subtitle}
				/>
			</div>

			<div className="mx-auto grid max-w-3xl grid-cols-1 gap-3.5 px-8 pb-12 md:grid-cols-3">
				{c.tiers.map((tier) => (
					<div
						key={tier.name}
						className={
							tier.featured
								? "glass relative flex flex-col border border-harvest-500 bg-gradient-to-b from-forest-700 to-[#143820] p-6 text-white md:scale-[1.02]"
								: "glass flex flex-col p-6"
						}
					>
						{tier.featured && (
							<span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-harvest-500 px-3 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-white">
								{c.mostChosen}
							</span>
						)}
						<div className="grad-text mb-1 font-serif text-[26px] italic tracking-[-0.01em]">{tier.name}</div>
						<div className={`mb-3.5 text-[11px] italic ${tier.featured ? "text-white/70" : "text-ink/55"}`}>{tier.forWhom}</div>
						<div className="mb-1 font-serif text-4xl leading-none tracking-[-0.02em]">{tier.price}</div>
						<div className={`mb-4 text-[11px] ${tier.featured ? "text-white/70" : "text-ink/55"}`}>{tier.unit}</div>
						<ul className="my-0 mb-4 flex flex-1 list-none flex-col gap-2 p-0">
							{tier.perks.map((perk) => (
								<li key={perk} className={`flex items-start gap-2 text-[12.5px] leading-[1.4] ${tier.featured ? "text-white/85" : "text-ink/75"}`}>
									<span className={tier.featured ? "mt-1.5 flex-shrink-0 text-[8px] text-harvest-200" : "mt-1.5 flex-shrink-0 text-[8px] text-forest-500"}>●</span>
									{perk}
								</li>
							))}
						</ul>
						<div className={`mb-3.5 border-t pt-3.5 text-center text-[11px] font-medium ${tier.featured ? "border-white/15 text-harvest-200" : "border-ink/[0.08] text-forest-700"}`}>
							{tier.impact}
						</div>
						<button className={`rounded-full border-none py-2.5 text-xs font-medium ${tier.featured ? "bg-harvest-500 text-white" : "bg-ink text-white"}`}>
							{tier.cta}
						</button>
					</div>
				))}
			</div>

			<SectionHeader
				num="02"
				eyebrow={c.wallHeader.eyebrow}
				title={
					<>
						{c.wallHeader.titleBefore}
						<em className="grad-text">{c.wallHeader.titleEm}</em>
					</>
				}
				subtitle={c.wallHeader.subtitle}
			/>
			<div className="mx-auto max-w-3xl px-8 pb-12">
				<div className="glass p-7">
					{c.wallTiers.map((tier) => (
						<div key={tier.label} className="mb-6 last:mb-0">
							<div className="mb-3 border-b border-ink/[0.06] pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-forest-700">{tier.label}</div>
							<div className="flex flex-wrap items-center justify-around gap-x-9 gap-y-6">
								{tier.logos.map((logo) => (
									<span key={logo} className={`font-serif italic ${tier.size} ${tier.color}`}>{logo}</span>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			<div id="advertise">
				<SectionHeader
					num="03"
					eyebrow={c.adsHeader.eyebrow}
					title={
						<>
							{c.adsHeader.titleBefore}
							<em className="grad-text">{c.adsHeader.titleEm}</em>
						</>
					}
					subtitle={c.adsHeader.subtitle}
				/>
			</div>
			<div className="mx-auto grid max-w-3xl gap-3.5 px-8 pb-12 md:grid-cols-2">
				{c.ads.map((ad) => (
					<div key={ad.name} className="glass p-5">
						<div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-forest-700/10 to-harvest-500/[0.12] text-xl">{ad.icon}</div>
						<div className="mb-1.5 text-[15px] font-medium tracking-[-0.005em]">{ad.name}</div>
						<div className="mb-3 text-[12.5px] leading-[1.5] text-ink/60">{ad.desc}</div>
						<div className="flex flex-wrap gap-1.5 border-t border-ink/[0.06] pt-2.5">
							{ad.specs.map((spec) => (
								<span key={spec} className="rounded bg-forest-700/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-forest-700">{spec}</span>
							))}
						</div>
					</div>
				))}
			</div>

			<SectionHeader
				eyebrow={c.faqHeader.eyebrow}
				title={
					<>
						{c.faqHeader.titleBefore}
						<em className="grad-text">{c.faqHeader.titleEm}</em>
					</>
				}
			/>
			<div className="mx-auto max-w-2xl px-8 pb-12">
				{c.faqs.map((faq) => (
					<div key={faq.q} className="glass mb-2.5 p-5">
						<h3 className="mb-2 font-serif text-[17px] font-normal tracking-[-0.01em]">{faq.q}</h3>
						<p className="m-0 text-[13px] leading-[1.55] text-ink/65">{faq.a}</p>
					</div>
				))}
			</div>

			<section className="mx-auto max-w-2xl px-8 py-12 text-center">
				<h2 className="mb-3 font-serif text-3xl font-normal leading-[1.2] tracking-[-0.02em]">
					{c.finalLine1}
					<br />
					<em className="grad-text">{c.finalEm}</em>
				</h2>
				<p className="mb-5 text-[13px] text-ink/55">{c.finalSub}</p>
				<CTARow>
					<CTA href="mailto:partners@agrinexus.io">{c.finalCta1}</CTA>
					<CTA href="#" variant="secondary">{c.finalCta2}</CTA>
				</CTARow>
			</section>
		</>
	);
}
