import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { BreakEvenProfitCard } from "@/components/break-even/BreakEvenProfitCard";
import { ConfidenceHint } from "@/components/ConfidenceHint";
import {
	cbotPriceStrToEurPerTonne,
	formatEur,
	parseBreakEvenInputs,
	profitAtPrice,
} from "@/lib/break-even";
import { formatBasisEur, resolveMarketEurPerTonne } from "@/lib/local-price";
import { loadMarketDesk, generateLiveMarketSignals } from "@/lib/market-live-desk";
import type { AppLocale } from "@/i18n/routing";

export const revalidate = 180;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "MarketMeta" });
	return { title: t("title") };
}

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
		title: "Market positions",
		subtitle: "Live prices, 90-day forecast and signal explanations.",
		forecastCardTitle: "Wheat · DEC26 forecast",
		confidenceTime: "06:42",
		todayLabel: "Today · €246",
		sepLabel: "Sep 30 · €268",
		optimalWindow: "OPTIMAL WINDOW",
		now: "Now",
		nowSub: "EU milling, DEC26",
		forecastSep: "Forecast Sep 30",
		overBreakEven: "Over break-even",
		overSubMissing: "Add costs in Settings",
		overSubVs: "vs. your break-even",
		basisLabel: "Basis vs CBOT",
		signalTitle: "Signal stack",
		heatmapTitle: "12-month selling-window heatmap",
		legendStrong: "Strong sell window",
		legendAcceptable: "Acceptable",
		legendHold: "Hold & hedge instead",
	},
	bg: {
		title: "Пазарни позиции",
		subtitle: "Цени на живо, 90-дневни прогнози и сигнали.",
		forecastCardTitle: "Пшеница · DEC26 прогноза",
		confidenceTime: "06:42",
		todayLabel: "Днес · €246",
		sepLabel: "30 сеп · €268",
		optimalWindow: "ОПТИМАЛЕН ПРОЗОРЕЦ",
		now: "Сега",
		nowSub: "EU milling, DEC26",
		forecastSep: "Прогноза 30 сеп",
		overBreakEven: "Над себестойност",
		overSubMissing: "Въведи разходи в Настройки",
		overSubVs: "спрямо твоя себестойност",
		basisLabel: "Basis спрямо CBOT",
		signalTitle: "Сигнален стек",
		heatmapTitle: "12-месечна heatmap карта за прозорец на продажба",
		legendStrong: "Силен прозорец за продажба",
		legendAcceptable: "Приемливо",
		legendHold: "Задръж и хеджирай вместо продажба",
	},
};

export default async function DashboardMarketPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const supabase = createClient();
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) redirect(`/${locale}/login`);

	const { data: profile } = await supabase
		.from("farm_profiles")
		.select("break_even_inputs, total_ha")
		.eq("user_id", session.user.id)
		.single();
	const breakEvenInputs = parseBreakEvenInputs(profile?.break_even_inputs);
	const totalHa = Number(profile?.total_ha) || 0;

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
	const timeFmt = new Intl.DateTimeFormat(isBg ? "bg-BG" : "en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(updated);

	const wheatRow = desk.rows.find((r) => r.sym === "WHEAT");
	const cbotEur = wheatRow ? cbotPriceStrToEurPerTonne(wheatRow.priceStr) : null;
	const priceResolved = breakEvenInputs
		? resolveMarketEurPerTonne(breakEvenInputs, cbotEur)
		: { eurPerTonne: cbotEur, source: "cbot" as const, basisEur: null };
	const refPriceEur = priceResolved.eurPerTonne;
	const marginPreview =
		breakEvenInputs && refPriceEur != null && totalHa > 0
			? profitAtPrice(refPriceEur, breakEvenInputs, totalHa)
			: null;

	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12">
			<div className="mb-6">
				<div className="font-serif text-2xl font-normal leading-[1.1] tracking-[-0.015em] md:text-[26px]">
					{c.title}
				</div>
				<div className="mt-1.5 text-sm text-ink/60">{c.subtitle}</div>
			</div>

			<BreakEvenProfitCard
				locale={locale}
				inputs={breakEvenInputs}
				totalHa={totalHa}
				wheatPriceStr={wheatRow?.priceStr}
			/>
			<p className="mt-2 mb-1 text-[12px] text-ink/55">
				<Link href="/dashboard/decisions" className="font-medium text-forest-700 underline underline-offset-2">
					{isBg ? "Запиши решение в дневника →" : "Log this decision in your diary →"}
				</Link>
			</p>

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start mt-6">
				<div className="flex flex-col gap-6">
					{/* Bloomberg-style terminal */}
					<div className="bg-[rgba(14,40,24,0.92)] rounded-2xl p-1 shadow-sm">
						<div className="bg-[#0a1a10] rounded-xl overflow-hidden text-forest-200 font-mono">
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
								</div>
							</div>

							<div className="p-4 flex flex-col gap-1.5">
								{desk.rows.length === 0 ? (
									<div className="text-forest-200/70 text-xs py-4">{desk.warning ?? t("rowsEmpty")}</div>
								) : (
									desk.rows.map((row) => (
										<div
											key={row.sym}
											className="grid grid-cols-[70px_1fr_90px_70px] sm:grid-cols-[70px_1fr_110px_90px_80px] gap-3.5 py-1.5 text-xs border-b border-forest-200/[0.04] last:border-b-0 items-center"
										>
											<span className="text-harvest-200 font-medium tracking-[0.04em]">{row.sym}</span>
											<span className="text-forest-200/70 text-[11px] truncate">{row.name}</span>
											<span className="text-[#f8f6f1] tabular-nums font-medium text-right sm:text-left">{row.priceStr}</span>
											<span className={`tabular-nums text-[11px] text-right sm:text-left ${row.up ? "text-forest-500" : "text-[#e09595]"}`}>{row.deltaStr}</span>
											<span className="hidden sm:flex items-end gap-px h-5">
												{row.spark.map((h, i) => (
													<span key={i} className="w-[3px] bg-harvest-500/60 rounded-sm" style={{ height: `${h}px` }} />
												))}
											</span>
										</div>
									))
								)}
							</div>
							<p className="px-4 pb-3 text-[10px] leading-snug text-forest-200/55 m-0">{t("dataDelayTicker")}</p>
						</div>
					</div>

					{/* Forecast Area Chart */}
					<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-5 md:p-6">
						<div className="flex justify-between items-baseline mb-4 pb-3.5 border-b border-ink/[0.06] gap-3">
							<div>
								<div className="font-serif text-lg md:text-xl font-normal tracking-[-0.015em]">{c.forecastCardTitle}</div>
								<span className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.08em] text-ink/45">
									{l("illustrativeBadge")}
								</span>
							</div>
							<div className="text-right font-mono text-[10px] text-ink/50">
								<ConfidenceHint
									label={signalLine}
									className="justify-end"
									labelClassName="text-[10px] text-ink/50"
								/>
							</div>
						</div>

						{wheatRow ? (
							<p className="text-[11px] text-ink/55 font-mono mb-3 m-0">
								{t("cbotRef")}: {wheatRow.priceStr} ({wheatRow.deltaStr})
							</p>
						) : null}

						<div className="h-[220px] mb-4 overflow-hidden relative">
							<svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full min-w-[500px]">
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
								<text x="4" y="48" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€280</text>
								<text x="4" y="98" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€250</text>
								<text x="4" y="148" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€220</text>

								<path d="M 320 70 Q 400 60 460 75 T 560 65 T 660 70 L 660 130 Q 560 125 460 130 T 320 130 Z" fill="url(#m-conf)" />
								<path d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95 L 320 170 L 0 170 Z" fill="url(#m-area)" />
								<path d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95" stroke="#1f4d2c" strokeWidth="2" fill="none" />
								<path d="M 320 95 Q 400 80 460 85 T 560 78 T 660 80" stroke="#c4a86a" strokeWidth="2" fill="none" strokeDasharray="4,3" />
								<line x1="320" y1="0" x2="320" y2="180" stroke="#0a0a0a" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
								<circle cx="320" cy="95" r="4" fill="#1f4d2c" />
								<circle cx="560" cy="78" r="4" fill="#c4a86a" />
								<text x="290" y="200" fontSize="10" fill="#0a0a0a" fontWeight="500">{c.todayLabel}</text>
								<text x="540" y="65" fontSize="10" fill="#8a6a2f" fontWeight="500">{c.sepLabel}</text>

								<rect x="440" y="0" width="120" height="180" fill="rgba(45,122,63,0.08)" stroke="none" />
								<text x="445" y="14" fontSize="9" fill="#2d7a3f" fontFamily="ui-monospace,monospace" fontWeight="600">{c.optimalWindow}</text>
							</svg>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3.5 border-t border-ink/[0.06]">
							<div className="py-1">
								<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.now}</div>
								<div className="font-serif text-[20px] text-forest-700 tracking-[-0.01em]">
									{refPriceEur != null ? formatEur(refPriceEur, locale) + "/t" : "—"}
								</div>
								<div className="text-[10px] text-ink/50 mt-0.5">{c.nowSub}</div>
								{priceResolved.basisEur != null &&
								priceResolved.source !== "cbot" ? (
									<div className="text-[10px] text-ink/55 mt-1 font-mono">
										{c.basisLabel}: {formatBasisEur(priceResolved.basisEur, locale)}
										{priceResolved.buyer?.name
											? ` · ${priceResolved.buyer.name}`
											: ""}
									</div>
								) : null}
							</div>
							<div className="py-1">
								<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.forecastSep}</div>
								<div className="font-serif text-[20px] text-harvest-700 tracking-[-0.01em]">€268 ±€14</div>
								<div className="text-[10px] text-ink/50 mt-0.5">
									<ConfidenceHint label={signalStrong} labelClassName="text-[10px] text-ink/50" />
								</div>
							</div>
							<div className="py-1">
								<div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">{c.overBreakEven}</div>
								<div
									className={`font-serif text-[20px] tracking-[-0.01em] ${
										marginPreview && marginPreview.marginPerTonne >= 0
											? "text-semantic-success"
											: marginPreview
												? "text-semantic-alert"
												: "text-ink/40"
									}`}
								>
									{marginPreview
										? `${marginPreview.marginPerTonne >= 0 ? "+" : ""}${formatEur(marginPreview.marginPerTonne, locale)}/t`
										: "—"}
								</div>
								<div className="text-[10px] text-ink/50 mt-0.5">
									{marginPreview
										? `${c.overSubVs} ${formatEur(marginPreview.breakEvenEurPerTonne, locale)}/t`
										: c.overSubMissing}
								</div>
							</div>
						</div>
						<p className="mt-3 pt-3 border-t border-ink/[0.06] text-[11px] leading-snug text-ink/45 m-0">
							{l("forecastShort")}
						</p>
					</div>

					{/* Heatmap */}
					<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-5 md:p-6">
						<h3 className="font-serif text-lg font-medium text-forest-700 m-0 mb-4 tracking-[-0.01em]">{c.heatmapTitle}</h3>
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
						<div className="flex gap-4 flex-wrap text-[10px] text-ink/60 mt-4">
							<span className="inline-flex items-center gap-1.5">
								<span className="inline-block w-2.5 h-1.5 rounded-sm bg-gradient-to-r from-forest-700 to-forest-500" />
								{c.legendStrong}
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span className="inline-block w-2.5 h-1.5 rounded-sm bg-gradient-to-r from-harvest-500 to-harvest-200" />
								{c.legendAcceptable}
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span className="inline-block w-2.5 h-1.5 rounded-sm bg-gradient-to-r from-earth-600 to-[#c89070]" />
								{c.legendHold}
							</span>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-6">
					{/* Signal Stack Sidebar */}
					<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-5">
						<h3 className="font-serif text-lg font-medium text-ink m-0 mb-4">{c.signalTitle}</h3>
						<div className="flex flex-col">
							{pageSignals.map((s, i) => (
								<div key={i} className="py-3 border-b border-ink/[0.05] last:border-b-0">
									<div className="flex items-center justify-between mb-1">
										<div
											className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] text-white font-bold ${
												s.dir === "up"
													? "bg-gradient-to-br from-semantic-success to-forest-500"
													: s.dir === "down"
														? "bg-gradient-to-br from-semantic-alert to-[#c47070]"
														: "bg-ink/30"
											}`}
										>
											{s.dir === "up" ? "↑" : s.dir === "down" ? "↓" : "~"}
										</div>
										<div
											className={`font-mono text-[10px] font-medium tabular-nums ${
												s.dir === "up" ? "text-semantic-success" : s.dir === "down" ? "text-semantic-alert" : "text-ink/50"
											}`}
										>
											{s.impact}
										</div>
									</div>
									<div className="text-xs leading-[1.3] text-ink font-medium mt-1.5">{s.text}</div>
									<div className="text-[9.5px] text-ink/50 mt-1 font-mono tracking-tight">{s.sub}</div>
								</div>
							))}
						</div>
					</div>
					
					{/* Desk Note / Disclaimer */}
					<div className="overflow-hidden rounded-2xl border border-ink/[0.06] bg-white/40 p-4">
						<p className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink/45 mb-1.5">{t("noteEyebrow")}</p>
						<p className="text-xs text-ink/75 leading-relaxed m-0 whitespace-pre-wrap">{desk.deskNote || t("noAi")}</p>
						<p className="text-[10px] text-ink/40 mt-3 mb-0 leading-snug">{t("delayDisclaimer")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
