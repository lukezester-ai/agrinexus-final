import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { CTA, CTARow } from "@/components/CTA";
import { ConfidenceHint } from "@/components/ConfidenceHint";
import { loadMarketDesk, generateLiveMarketSignals } from "@/lib/market-live-desk";
import type { AppLocale } from "@/i18n/routing";

export const revalidate = 180;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "MarketMeta" });
	return {
		title: t("title"),
		description: t("description"),
	};
}

const signals = {
	en: [
		{ dir: "up", text: "Russia extended grain export quotas", sub: "[NWS] 12 sources · published 03:14 EET · correlation 0.74", impact: "+0.9%" },
		{ dir: "up", text: "US Plains drought index +12 points", sub: "[WTR] NOAA + Sentinel-2 · correlation 0.68", impact: "+0.7%" },
		{ dir: "up", text: "EUR weaker vs USD by 1.2% overnight", sub: "[FIN] ECB rate decision priced in · correlation 0.55", impact: "+0.5%" },
		{ dir: "flat", text: "USDA WASDE report tomorrow", sub: "[NWS] historical: 60% of moves happen post-release", impact: "±0.0%" },
		{ dir: "down", text: "Argentine harvest 3% above forecast", sub: "[SAT] Planet Labs imagery · correlation 0.62", impact: "−0.3%" },
	],
	bg: [
		{ dir: "up", text: "Русия удължи квотите за износ на зърно", sub: "[NWS] 12 източника · публикувано 03:14 EET · корелация 0.74", impact: "+0.9%" },
		{ dir: "up", text: "Индексът за суша в US Plains се повиши с 12 пункта", sub: "[WTR] NOAA + Sentinel-2 · корелация 0.68", impact: "+0.7%" },
		{ dir: "up", text: "Еврото отслабна спрямо долара с 1.2% през нощта", sub: "[FIN] решение на ЕЦБ вече е в цената · корелация 0.55", impact: "+0.5%" },
		{ dir: "flat", text: "Докладът USDA WASDE излиза утре", sub: "[NWS] исторически: 60% от движенията идват след публикация", impact: "±0.0%" },
		{ dir: "down", text: "Аржентинската реколта е 3% над прогнозата", sub: "[SAT] Planet Labs imagery · корелация 0.62", impact: "−0.3%" },
	],
};

const months = [
	{ mo: "Jun", price: "€246", opacity: 0.5, color: "#c4a86a" },
	{ mo: "Jul", price: "€254", opacity: 0.7, color: "#c4a86a" },
	{ mo: "Aug", price: "€261", opacity: 0.6, color: "#5a9968" },
	{ mo: "Sep", price: "€268", opacity: 0.85, color: "#5a9968" },
	{ mo: "Oct", price: "€272", opacity: 0.9, color: "#1f4d2c" },
	{ mo: "Nov", price: "€270", opacity: 0.95, color: "#1f4d2c" },
	{ mo: "Dec", price: "€264", opacity: 0.75, color: "#5a9968" },
	{ mo: "Jan", price: "€255", opacity: 0.5, color: "#5a9968" },
	{ mo: "Feb", price: "€243", opacity: 0.55, color: "#b87a3d" },
	{ mo: "Mar", price: "€238", opacity: 0.7, color: "#b87a3d" },
	{ mo: "Apr", price: "€241", opacity: 0.5, color: "#c4a86a" },
	{ mo: "May", price: "€247", opacity: 0.6, color: "#c4a86a" },
];

const bgMonths = ["Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек", "Яну", "Фев", "Мар", "Апр", "Май"];

const copy = {
	en: {
		heroEyebrow: "// Market intelligence",
		heroLine1: "Trade like a hedge fund.",
		heroEm: "Farm like a craftsman.",
		heroSubtitle:
			"Real-time prices, 90-day forecasts, signal explanations. The same data the agribusiness desks use — translated for the farm, free for every grower.",
		forecastEyebrow: "90-day forecast",
		forecastTitleBefore: "Where wheat ",
		forecastTitleEm: "is going.",
		forecastSub:
			"Ensemble of weather, demand, currency and supply models. Confidence interval shown so you know how much weight to give it.",
		forecastCardTitle: "Wheat · DEC26 forecast",
		confidenceTime: "06:42",
		todayLabel: "Today · €246",
		sepLabel: "Sep 30 · €268",
		optimalWindow: "OPTIMAL WINDOW",
		now: "Now",
		nowSub: "EU milling, DEC26",
		forecastSep: "Forecast Sep 30",
		overBreakEven: "Over break-even",
		overSub: "vs. your €184 cost",
		signalEyebrow: "Signal stack",
		signalTitleBefore: "Why the price is ",
		signalTitleEm: "moving.",
		signalSub: "Every forecast carries its evidence. Click any signal to see the source articles, datasets, and historical correlation.",
		optimizerEyebrow: "Selling window optimizer",
		optimizerTitleBefore: "When to lock, ",
		optimizerTitleEm: "when to wait.",
		optimizerSub:
			"For each 30-day window over the next year, the optimizer estimates expected price, risk-adjusted return, and basis. The agent doesn't tell you what to do — it tells you the math.",
		heatmapTitle: "12-month selling-window heatmap",
		legendStrong: "Strong sell window",
		legendAcceptable: "Acceptable",
		legendHold: "Hold & hedge instead",
		roiEyebrow: "Example scenario",
		roiTitleBefore: "Illustrative ",
		roiTitleEm: "decision math.",
		roiSub: "How a split forward-selling window might be presented — not verified aggregate farm results.",
		roiMetric: "example uplift in a model scenario (€/t)",
		roiText:
			"In this illustration, a 300 ha farm at 6 t/ha compares a split forward window vs a one-shot sale. Numbers are for demonstration only; your break-even, basis, and logistics differ.",
		finalLine1: "Get the same intelligence",
		finalLine2: "the desks have.",
		finalSub: "It comes turned on, day one. Free. Forever.",
		finalCta1: "Open the desk →",
		finalCta2: "Meet MarketAgent",
	},
	bg: {
		heroEyebrow: "// Пазарно разузнаване",
		heroLine1: "Търгувай с данни като desk.",
		heroEm: "Фермерствай с майсторство.",
		heroSubtitle:
			"Цени в реално време, 90-дневни прогнози и обяснение на сигналите. Данните, които използват агро desk-овете, преведени за стопанството и безплатни за всеки производител.",
		forecastEyebrow: "90-дневна прогноза",
		forecastTitleBefore: "Накъде отива ",
		forecastTitleEm: "пшеницата.",
		forecastSub:
			"Комбинация от модели за време, търсене, валути и предлагане. Показваме и интервал на увереност, за да знаеш колко тежест да му дадеш.",
		forecastCardTitle: "Пшеница · DEC26 прогноза",
		confidenceTime: "06:42",
		todayLabel: "Днес · €246",
		sepLabel: "30 сеп · €268",
		optimalWindow: "ОПТИМАЛЕН ПРОЗОРЕЦ",
		now: "Сега",
		nowSub: "EU milling, DEC26",
		forecastSep: "Прогноза 30 сеп",
		overBreakEven: "Над себестойност",
		overSub: "спрямо твоя разход €184",
		signalEyebrow: "Сигнален стек",
		signalTitleBefore: "Защо цената ",
		signalTitleEm: "се движи.",
		signalSub: "Всяка прогноза носи доказателства: източници, datasets и историческа корелация.",
		optimizerEyebrow: "Оптимизатор на прозорец за продажба",
		optimizerTitleBefore: "Кога да заключиш цена, ",
		optimizerTitleEm: "кога да изчакаш.",
		optimizerSub:
			"За всеки 30-дневен прозорец през следващата година оптимизаторът оценява очаквана цена, риск-коригирана доходност и basis. Агентът не казва какво да правиш — показва математиката.",
		heatmapTitle: "12-месечна heatmap карта за прозорец на продажба",
		legendStrong: "Силен прозорец за продажба",
		legendAcceptable: "Приемливо",
		legendHold: "Задръж и хеджирай вместо продажба",
		roiEyebrow: "Примерен сценарий",
		roiTitleBefore: "Илюстративна ",
		roiTitleEm: "математика на решение.",
		roiSub: "Как може да изглежда прозорец с разделена форуърд продажба — не проверени агрегирани резултати от стопанства.",
		roiMetric: "примерно подобрение в моделен сценарий (€/т)",
		roiText:
			"В тази илюстрация 300 ha при 6 t/ha сравняват разделен forward прозорец с еднократна продажба. Числата са само за демонстрация; твоята себестойност, базис и логистика са различни.",
		finalLine1: "Получаваш същото разузнаване",
		finalLine2: "което имат desk-овете.",
		finalSub: "Включено е от първия ден. Безплатно. Завинаги.",
		finalCta1: "Отвори desk-а →",
		finalCta2: "Виж MarketAgent",
	},
};

export default async function MarketPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "MarketDesk" });
	const l = await getTranslations({ locale, namespace: "Legal" });
	const tc = await getTranslations({ locale, namespace: "Confidence" });
	const desk = await loadMarketDesk(locale as AppLocale);
	const isBg = locale === "bg";
	const c = isBg ? copy.bg : copy.en;
	const signalStrong = tc("signalStrong");
	const signalLine = tc("signalLine", { level: signalStrong, time: c.confidenceTime });
	const pageSignals = await generateLiveMarketSignals(locale as AppLocale);
	const pageMonths = isBg ? months.map((m, i) => ({ ...m, mo: bgMonths[i] })) : months;
	const updated = new Date(desk.updatedAt);
	const timeFmt = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(updated);

	const wheatRow = desk.rows.find((r) => r.sym === "WHEAT");

	return (
		<>
			<Hero
				eyebrow={c.heroEyebrow}
				title={
					<>
						{c.heroLine1}
						<br />
						<em className="grad-text not-italic [font-style:italic]">{c.heroEm}</em>
					</>
				}
				subtitle={c.heroSubtitle}
			/>

			{/* Live desk note (Mistral) + disclaimer */}
			<div className="px-6 pb-2 max-w-3xl mx-auto">
				<div className="glass p-5 rounded-[18px] border border-ink/[0.06]">
					<p className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink/45 mb-1">{t("noteEyebrow")}</p>
					{desk.deskNote ? (
						<p className="text-sm text-ink/80 leading-relaxed m-0 whitespace-pre-wrap">{desk.deskNote}</p>
					) : (
						<p className="text-sm text-ink/55 m-0">{t("noAi")}</p>
					)}
					<p className="text-[11px] text-ink/45 mt-3 mb-0 leading-snug">{t("delayDisclaimer")}</p>
				</div>
			</div>

			{/* Bloomberg-style terminal — live CBOT rows */}
			<div className="px-6 py-8 max-w-3xl mx-auto">
				<div className="bg-[rgba(14,40,24,0.92)] rounded-[18px] p-1 shadow-[0_30px_60px_-20px_rgba(14,40,24,0.4),0_12px_24px_-12px_rgba(31,77,44,0.2)]">
					<div className="bg-[#0a1a10] rounded-[15px] overflow-hidden text-forest-200 font-mono">
						<div className="flex items-center justify-between py-3 px-4 border-b border-forest-200/10 text-[10px]">
							<div className="flex gap-3.5 flex-wrap">
								<span className="text-harvest-200">AGRX</span>
								<span>{t("terminalTitle")}</span>
								<span className="text-forest-200/50">{timeFmt}</span>
							</div>
							<div className="text-forest-200/50 flex gap-3.5 items-center flex-wrap justify-end">
								<span className="inline-flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-forest-500 before:animate-pulse">
									{t("liveBadge")}
								</span>
								<span className="text-forest-200/40 max-w-[200px] text-right">{desk.source}</span>
							</div>
						</div>

						<div className="p-4 flex flex-col gap-1.5">
							{desk.rows.length === 0 ? (
								<div className="text-forest-200/70 text-xs py-4">{desk.warning ?? t("rowsEmpty")}</div>
							) : (
								desk.rows.map((row) => (
									<div
										key={row.sym}
										className="grid grid-cols-[70px_1fr_110px_90px_80px] gap-3.5 py-1.5 text-xs border-b border-forest-200/[0.04] last:border-b-0 items-center"
									>
										<span className="text-harvest-200 font-medium tracking-[0.04em]">{row.sym}</span>
										<span className="text-forest-200/70 text-[11px]">{row.name}</span>
										<span className="text-[#f8f6f1] tabular-nums font-medium">{row.priceStr}</span>
										<span className={`tabular-nums text-[11px] ${row.up ? "text-forest-500" : "text-[#e09595]"}`}>{row.deltaStr}</span>
										<span className="hidden sm:flex items-end gap-px h-5">
											{row.spark.map((h, i) => (
												<span key={i} className="w-[3px] bg-harvest-500/60 rounded-sm" style={{ height: `${h}px` }} />
											))}
										</span>
									</div>
								))
							)}
						</div>
						{desk.warning && desk.rows.length > 0 ? (
							<div className="px-4 pb-3 text-[10px] text-harvest-200/80">{desk.warning}</div>
						) : null}
						<p className="px-4 pb-3 text-[10px] leading-snug text-forest-200/55 m-0">{t("dataDelayTicker")}</p>
					</div>
				</div>
			</div>

			{/* Forecast (illustrative UI) — tie “now” to live CBOT wheat when available */}
			<SectionHeader
				num="01"
				eyebrow={c.forecastEyebrow}
				title={
					<>
						{c.forecastTitleBefore}
						<em className="grad-text">{c.forecastTitleEm}</em>
					</>
				}
				subtitle={c.forecastSub}
			/>
			<div className="px-6 pb-8 max-w-3xl mx-auto">
				<div className="glass p-6">
					<div className="flex justify-between items-baseline mb-4 pb-3.5 border-b border-ink/[0.06] gap-3">
						<div>
							<div className="font-serif text-xl font-normal tracking-[-0.015em]">{c.forecastCardTitle}</div>
							<span className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.08em] text-ink/45">
								{l("illustrativeBadge")}
							</span>
						</div>
						<div className="text-right font-mono text-[11px] text-ink/50">
							<ConfidenceHint
								label={signalLine}
								className="justify-end"
								labelClassName="text-[11px] text-ink/50"
							/>
						</div>
					</div>

					{wheatRow ? (
						<p className="text-[11px] text-ink/55 font-mono mb-3 m-0">
							{t("cbotRef")}: {wheatRow.priceStr} ({wheatRow.deltaStr})
						</p>
					) : null}

					<div className="h-[220px] mb-4">
						<svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full">
							<defs>
								<linearGradient id="m-area" x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stopColor="#5a9968" stopOpacity="0.3" />
									<stop offset="100%" stopColor="#5a9968" stopOpacity="0" />
								</linearGradient>
								<linearGradient id="m-conf" x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stopColor="#c4a86a" stopOpacity="0.18" />
									<stop offset="100%" stopColor="#c4a86a" stopOpacity="0.02" />
								</linearGradient>
							</defs>
							<g opacity="0.3">
								<line x1="0" y1="50" x2="700" y2="50" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4" />
								<line x1="0" y1="100" x2="700" y2="100" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4" />
								<line x1="0" y1="150" x2="700" y2="150" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4" />
							</g>
							<text x="4" y="48" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">
								€280
							</text>
							<text x="4" y="98" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">
								€250
							</text>
							<text x="4" y="148" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">
								€220
							</text>

							<path d="M 320 70 Q 400 60 460 75 T 560 65 T 660 70 L 660 130 Q 560 125 460 130 T 320 130 Z" fill="url(#m-conf)" />
							<path d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95 L 320 170 L 0 170 Z" fill="url(#m-area)" />
							<path
								d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95"
								stroke="#1f4d2c"
								strokeWidth="2"
								fill="none"
							/>
							<path d="M 320 95 Q 400 80 460 85 T 560 78 T 660 80" stroke="#c4a86a" strokeWidth="2" fill="none" strokeDasharray="4,3" />
							<line x1="320" y1="0" x2="320" y2="180" stroke="#0a0a0a" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
							<circle cx="320" cy="95" r="4" fill="#1f4d2c" />
							<circle cx="560" cy="78" r="4" fill="#c4a86a" />
							<text x="290" y="200" fontSize="10" fill="#0a0a0a" fontWeight="500">
								{c.todayLabel}
							</text>
							<text x="540" y="65" fontSize="10" fill="#8a6a2f" fontWeight="500">
								{c.sepLabel}
							</text>

							<rect x="440" y="0" width="120" height="180" fill="rgba(45,122,63,0.08)" stroke="none" />
							<text x="445" y="14" fontSize="9" fill="#2d7a3f" fontFamily="ui-monospace,monospace" fontWeight="600">
								{c.optimalWindow}
							</text>

							<g fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">
								<text x="0" y="215">
									Jun
								</text>
								<text x="80" y="215">
									Jul
								</text>
								<text x="160" y="215">
									Aug
								</text>
								<text x="240" y="215">
									Sep
								</text>
								<text x="380" y="215">
									Oct
								</text>
								<text x="460" y="215">
									Nov
								</text>
								<text x="540" y="215">
									Dec
								</text>
								<text x="620" y="215">
									Jan
								</text>
							</g>
						</svg>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5 border-t border-ink/[0.06]">
						<div className="py-2.5">
							<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.now}</div>
							<div className="font-serif text-[22px] text-forest-700 tracking-[-0.01em]">€246</div>
							<div className="text-[10px] text-ink/50 mt-0.5">{c.nowSub}</div>
						</div>
						<div className="py-2.5">
							<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.forecastSep}</div>
							<div className="font-serif text-[22px] text-harvest-700 tracking-[-0.01em]">€268 ±€14</div>
							<div className="text-[10px] text-ink/50 mt-0.5">
								<ConfidenceHint label={signalStrong} labelClassName="text-[10px] text-ink/50" />
							</div>
						</div>
						<div className="py-2.5">
							<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.overBreakEven}</div>
							<div className="font-serif text-[22px] text-semantic-success tracking-[-0.01em]">+€84/t</div>
							<div className="text-[10px] text-ink/50 mt-0.5">{c.overSub}</div>
						</div>
					</div>
					<p className="mt-3 pt-3 border-t border-ink/[0.06] text-[11px] leading-snug text-ink/45 m-0">
						{l("forecastShort")}
					</p>
				</div>
			</div>

			{/* Signal stack */}
			<SectionHeader
				num="02"
				eyebrow={c.signalEyebrow}
				title={
					<>
						{c.signalTitleBefore}
						<em className="grad-text">{c.signalTitleEm}</em>
					</>
				}
				subtitle={c.signalSub}
			/>
			<div className="px-6 pb-8 max-w-3xl mx-auto">
				<div className="glass p-6">
					{pageSignals.map((s) => (
						<div key={s.text} className="grid grid-cols-[28px_1fr_60px] gap-3 py-3 border-b border-ink/[0.05] last:border-b-0 items-center">
							<div
								className={`w-5.5 h-5.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-white font-semibold ${
									s.dir === "up"
										? "bg-gradient-to-br from-semantic-success to-forest-500"
										: s.dir === "down"
											? "bg-gradient-to-br from-semantic-alert to-[#c47070]"
											: "bg-ink/20"
								}`}
							>
								{s.dir === "up" ? "↑" : s.dir === "down" ? "↓" : "~"}
							</div>
							<div className="text-[13px] leading-[1.4]">
								<strong className="font-medium">{s.text}</strong>
								<span className="block text-[11px] text-ink/50 mt-0.5 font-mono">{s.sub}</span>
							</div>
							<div
								className={`font-mono text-[11px] text-right tabular-nums font-medium ${
									s.dir === "up" ? "text-semantic-success" : s.dir === "down" ? "text-semantic-alert" : "text-ink/50"
								}`}
							>
								{s.impact}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Window optimizer */}
			<SectionHeader
				num="03"
				eyebrow={c.optimizerEyebrow}
				title={
					<>
						{c.optimizerTitleBefore}
						<em className="grad-text">{c.optimizerTitleEm}</em>
					</>
				}
				subtitle={c.optimizerSub}
			/>
			<div className="px-6 pb-8 max-w-3xl mx-auto">
				<div className="glass p-6">
					<h3 className="font-serif text-[22px] italic text-forest-700 m-0 mb-3.5 tracking-[-0.01em]">{c.heatmapTitle}</h3>
					<div className="grid grid-cols-6 md:grid-cols-12 gap-1 mb-4">
						{pageMonths.map((m) => (
							<div key={m.mo} className="text-center">
								<div className="font-mono text-[9px] text-ink/70 mb-1">{m.mo}</div>
								<div
									className="rounded text-white text-[9px] font-mono font-semibold py-2"
									style={{ backgroundColor: m.color, opacity: m.opacity }}
								>
									{m.price}
								</div>
							</div>
						))}
					</div>
					<div className="flex gap-4 flex-wrap text-[11px] text-ink/60">
						<span className="inline-flex items-center gap-1.5">
							<span className="inline-block w-3 h-1.5 rounded-sm bg-gradient-to-r from-forest-700 to-forest-500" />
							{c.legendStrong}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="inline-block w-3 h-1.5 rounded-sm bg-gradient-to-r from-harvest-500 to-harvest-200" />
							{c.legendAcceptable}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="inline-block w-3 h-1.5 rounded-sm bg-gradient-to-r from-earth-600 to-[#c89070]" />
							{c.legendHold}
						</span>
					</div>
				</div>
			</div>

			{/* ROI proof */}
			<SectionHeader
				num="04"
				eyebrow={c.roiEyebrow}
				title={
					<>
						{c.roiTitleBefore}
						<em className="grad-text">{c.roiTitleEm}</em>
					</>
				}
				subtitle={c.roiSub}
			/>
			<div className="px-6 pb-8 max-w-3xl mx-auto">
				<div className="glass p-7 text-center">
					<p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45 mb-2">{l("roiExampleTitle")}</p>
					<div className="font-serif text-5xl italic text-semantic-success tracking-[-0.025em] leading-none mb-2">+€18/t</div>
					<div className="text-[13px] text-ink/60 mb-4">{c.roiMetric}</div>
					<p className="text-xs text-ink/50 max-w-md mx-auto leading-[1.5]">{c.roiText}</p>
					<p className="text-[11px] text-ink/40 max-w-md mx-auto leading-snug mt-3 mb-0">{l("roiExampleBody")}</p>
				</div>
			</div>

			<section className="py-14 px-8 max-w-3xl mx-auto text-center">
				<h2 className="font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em] mb-3 bg-gradient-to-br from-ink to-forest-700 bg-clip-text text-transparent">
					{c.finalLine1}
					<br />
					{c.finalLine2}
				</h2>
				<p className="text-sm text-ink/55 mb-6">{c.finalSub}</p>
				<CTARow>
					<CTA href="/dashboard">{c.finalCta1}</CTA>
					<CTA href="/agents" variant="secondary">
						{c.finalCta2}
					</CTA>
				</CTARow>
			</section>
		</>
	);
}
