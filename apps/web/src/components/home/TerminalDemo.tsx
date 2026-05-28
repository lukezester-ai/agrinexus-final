const legal = {
	en: {
		forecastShort:
			"Informational forecast only — not investment or trading advice. Selling and hedging decisions are entirely yours.",
		signalStrong: "Strong signal",
		hintTitle: "How we estimate confidence",
		hintBody:
			"This reading shows how aligned today's signals are. When market data, news, weather, and FX point the same way, the signal is strong; when they conflict, it is mixed or weak. Judgment aid, not a guarantee.",
		methodologyHref: "/methodology",
		methodologyLink: "Full methodology →",
	},
	bg: {
		forecastShort:
			"Информативна прогноза, не е инвестиционен или търговски съвет. Решенията за продажба и хеджиране са изцяло твои.",
		signalStrong: "Силен сигнал",
		hintTitle: "Как смятаме увереността",
		hintBody:
			"Показателят отразява колко силно се подреждат наличните сигнали. Когато пазар, новини, метео и валута сочат заедно — сигналът е силен; при противоречие — смесен или слаб. Ориентир, не гаранция.",
		methodologyHref: "/methodology",
		methodologyLink: "Пълна методология →",
	},
};

const copy = {
	en: {
		header: "Daily Briefing · 06:42 EET",
		tabs: ["Market", "Field", "Cashflow"],
		consulted: "AgriNexus · 4 agents consulted",
		headline: <>Wheat opened <span className="text-semantic-success font-medium tabular-nums">+2.4%</span> on Black Sea export news</>,
		body: (
			<>
				Russia signaled extended export quotas overnight. Your local cash equivalent climbed from{" "}
				<strong className="font-medium text-ink">€238 → €246/t</strong>. With 60t still uncontracted, this is a strong window for a{" "}
				<strong className="font-medium text-ink">forward contract through October</strong>.
			</>
		),
		actions: ["✓ Lock 60t @ €246", "⏵ Wait for USDA", "Full analysis"],
		behind: "Behind this call",
		forecast: "Wheat · 90d forecast",
		conf: "Strong signal",
		chartMonths: ["Jun", "Jul", "Today", "Sep", "Oct"],
		now: <>Now <strong className="font-medium text-ink">€246</strong></>,
		target: "Target Sep 30 · €268 ±€14",
		signalStack: "Signal stack",
		agents: [
			{ color: "#1f4d2c", text: "MarketAgent: detected ±2.1σ price move", tag: "MKT" },
			{ color: "#5a9968", text: "NewsAgent: parsed 142 sources overnight", tag: "NWS" },
			{ color: "#c4a86a", text: "FinanceAgent: break-even confirmed €184/t", tag: "FIN" },
			{ color: "#b87a3d", text: "WeatherAgent: dry US Plains, bullish bias", tag: "WTR" },
		],
		signals: [
			{ color: "#2d7a3f", text: "Russia export quota extended", delta: "+0.9%" },
			{ color: "#2d7a3f", text: "US Plains drought index +12", delta: "+0.7%" },
			{ color: "#b87a3d", text: "EUR weaker vs USD", delta: "+0.5%" },
			{ color: "#a85050", text: "Argentine harvest +3% YoY", delta: "−0.3%" },
		],
	},
	bg: {
		header: "Дневен briefing · 06:42 EET",
		tabs: ["Пазар", "Поле", "Паричен поток"],
		consulted: "AgriNexus · 4 агента консултирани",
		headline: <>Пшеницата отвори <span className="text-semantic-success font-medium tabular-nums">+2.4%</span> след новини за Черноморския износ</>,
		body: (
			<>
				Русия сигнализира удължаване на износните квоти през нощта. Локалният cash еквивалент се повиши от{" "}
				<strong className="font-medium text-ink">€238 → €246/т</strong>. При 60 т без договор това е силен прозорец за{" "}
				<strong className="font-medium text-ink">forward договор до октомври</strong>.
			</>
		),
		actions: ["✓ Заключи 60 т @ €246", "⏵ Изчакай USDA", "Пълен анализ"],
		behind: "Зад това решение",
		forecast: "Пшеница · 90 дни прогноза",
		conf: "Силен сигнал",
		chartMonths: ["Юни", "Юли", "Днес", "Сеп", "Окт"],
		now: <>Сега <strong className="font-medium text-ink">€246</strong></>,
		target: "Цел 30 сеп · €268 ±€14",
		signalStack: "Сигнален стек",
		agents: [
			{ color: "#1f4d2c", text: "MarketAgent: засече ±2.1σ ценово движение", tag: "MKT" },
			{ color: "#5a9968", text: "NewsAgent: прочете 142 източника през нощта", tag: "NWS" },
			{ color: "#c4a86a", text: "FinanceAgent: потвърди себестойност €184/т", tag: "FIN" },
			{ color: "#b87a3d", text: "WeatherAgent: сухи US Plains, bullish наклон", tag: "WTR" },
		],
		signals: [
			{ color: "#2d7a3f", text: "Удължена квота за износ от Русия", delta: "+0.9%" },
			{ color: "#2d7a3f", text: "US Plains drought index +12", delta: "+0.7%" },
			{ color: "#b87a3d", text: "EUR по-слабо спрямо USD", delta: "+0.5%" },
			{ color: "#a85050", text: "Аржентинска реколта +3% г/г", delta: "−0.3%" },
		],
	},
};

export function TerminalDemo({ locale = "en" }: { locale?: string }) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const l = locale === "bg" ? legal.bg : legal.en;

	return (
		<section id="demo" className="mx-auto max-w-3xl px-6 pb-7 pt-10">
			<div className="rounded-[22px] border border-white/70 bg-white/60 p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_40px_80px_-24px_rgba(10,10,10,0.22),0_16px_32px_-16px_rgba(31,77,44,0.15)] backdrop-blur-2xl">
				<div className="overflow-hidden rounded-[18px] bg-[rgba(252,251,247,0.92)]">
					<div className="flex items-center justify-between border-b border-ink/[0.06] px-5 py-3.5">
						<div className="flex items-center gap-2 text-xs font-medium text-ink/55">
							<span className="live-dot" /> {c.header}
						</div>
						<div className="flex gap-4 text-[11px] text-ink/40">
							<span className="font-medium text-ink">{c.tabs[0]}</span>
							<span>{c.tabs[1]}</span>
							<span>{c.tabs[2]}</span>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-px bg-ink/[0.05] md:grid-cols-[1.4fr_1fr]">
						<div className="bg-[rgba(252,251,247,0.92)] px-5 py-4">
							<div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-ink/45">
								<span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-gradient text-[10px] text-white">✦</span>
								{c.consulted}
							</div>
							<div className="mb-2.5 text-lg font-medium leading-[1.25] tracking-[-0.015em]">{c.headline}</div>
							<p className="mb-3 text-[12.5px] leading-[1.55] text-ink/65">{c.body}</p>
							<div className="flex flex-wrap gap-1.5">
								<span className="inline-flex items-center gap-1 rounded border border-forest-700/[0.15] bg-forest-700/[0.07] px-2.5 py-1 text-[11px] font-medium text-forest-700">{c.actions[0]}</span>
								<span className="rounded border border-harvest-500/25 bg-harvest-500/10 px-2.5 py-1 text-[11px] font-medium text-harvest-700">{c.actions[1]}</span>
								<span className="rounded border border-harvest-500/25 bg-harvest-500/10 px-2.5 py-1 text-[11px] font-medium text-harvest-700">{c.actions[2]}</span>
							</div>
							<p className="mt-2 text-[10px] leading-snug text-ink/45">{l.forecastShort}</p>
							<div className="mt-3 border-t border-ink/[0.06] pt-3">
								<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-ink/45">{c.behind}</div>
								<div className="flex flex-col gap-1.5">
									{c.agents.map((agent) => (
										<div key={agent.tag} className="flex items-center gap-2 text-[11px] text-ink/70">
											<span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: agent.color }} />
											{agent.text}
											<span className="ml-auto font-mono text-[9px] text-ink/40">[{agent.tag}]</span>
										</div>
									))}
								</div>
							</div>
						</div>

						<div className="bg-[rgba(252,251,247,0.92)] px-5 py-4">
							<div className="mb-2 flex items-baseline justify-between gap-2">
								<span className="text-[11px] font-medium text-ink/55">{c.forecast}</span>
								<div className="text-right text-[10px] text-ink/40">
									<span className="inline-flex items-center gap-1">
										{l.signalStrong}
										<details className="relative inline-block text-left">
											<summary className="inline-flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded-full border border-ink/20 bg-ink/[0.04] text-[10px] font-semibold text-ink/55 [&::-webkit-details-marker]:hidden">
												?
											</summary>
											<div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-ink/10 bg-white px-3 py-2 text-[10px] leading-relaxed text-ink/75 shadow-lg">
												<strong className="mb-1 block text-ink">{l.hintTitle}</strong>
												{l.hintBody}
												<a href={l.methodologyHref} className="mt-2 inline-block font-medium text-forest-700 underline">
													{l.methodologyLink}
												</a>
											</div>
										</details>
									</span>
								</div>
							</div>
							<div className="h-[120px]">
								<svg viewBox="0 0 260 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="h-full w-full">
									<defs>
										<linearGradient id="mk-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5a9968" stopOpacity="0.35" /><stop offset="100%" stopColor="#5a9968" stopOpacity="0" /></linearGradient>
										<linearGradient id="mk-conf" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c4a86a" stopOpacity="0.15" /><stop offset="100%" stopColor="#c4a86a" stopOpacity="0.02" /></linearGradient>
									</defs>
									<path d="M 120 30 Q 160 25 200 35 T 260 40 L 260 90 Q 200 80 160 75 T 120 80 Z" fill="url(#mk-conf)" />
									<path d="M 0 75 L 10 73 L 20 78 L 30 70 L 40 72 L 50 68 L 60 65 L 70 70 L 80 62 L 90 58 L 100 55 L 110 60 L 120 52 L 120 88 L 0 88 Z" fill="url(#mk-area)" />
									<path d="M 0 75 L 10 73 L 20 78 L 30 70 L 40 72 L 50 68 L 60 65 L 70 70 L 80 62 L 90 58 L 100 55 L 110 60 L 120 52" stroke="#1f4d2c" strokeWidth="1.5" fill="none" />
									<path d="M 120 52 Q 150 45 180 50 T 230 48 T 260 50" stroke="#c4a86a" strokeWidth="1.5" fill="none" strokeDasharray="3,2" />
									<line x1="120" y1="0" x2="120" y2="120" stroke="#0a0a0a" strokeWidth="0.4" strokeDasharray="2,2" opacity="0.3" />
									<circle cx="120" cy="52" r="3" fill="#1f4d2c" />
									<circle cx="200" cy="49" r="3" fill="#c4a86a" />
									<text x="206" y="46" fontSize="9" fill="#8a6a2f" fontWeight="500">€268</text>
									{c.chartMonths.map((month, i) => (
										<text key={month} x={[2, 62, 118, 180, 240][i]} y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">{month}</text>
									))}
								</svg>
							</div>
							<div className="mt-1.5 flex items-baseline justify-between text-[10px] text-ink/45">
								<span>{c.now}</span>
								<span className="font-medium text-semantic-success">{c.target}</span>
							</div>
							<div className="mt-3 border-t border-ink/[0.06] pt-3">
								<div className="mb-2 text-[10px] uppercase tracking-[0.06em] text-ink/45">{c.signalStack}</div>
								<div className="flex flex-col gap-1.5">
									{c.signals.map((signal) => (
										<div key={signal.text} className="flex items-center gap-2 text-[11px] text-ink/70">
											<span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: signal.color }} />
											{signal.text}
											<span className="ml-auto font-mono text-[9px] text-ink/40">{signal.delta}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
