import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BreakEvenProfitCard } from "@/components/break-even/BreakEvenProfitCard";
import { DecisionDiaryTeaser } from "@/components/decision-diary/DecisionDiaryTeaser";
import { createClient } from "@/lib/supabase-server";
import { parseBreakEvenInputs } from "@/lib/break-even";
import { parseDecisionRow, type DecisionDiaryEntry } from "@/lib/decision-diary";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? { title: "Табло", description: "Твоето стопанство, обобщено: briefing, агенти, пазари и задачи." }
		: { title: "Dashboard", description: "Your farm, summarized. Daily briefing, agent activity, market positions." };
}

// Резервни статични данни, ако потребителят все още няма свои полета
const defaultFields = [
	{ swatch: "#1f4d2c", name: "A-205", ha: "42 ha", crop: { en: "Wheat", bg: "Пшеница" }, stat: "0.84", status: "healthy" as const },
	{ swatch: "#c4a86a", name: "A-204", ha: "87 ha", crop: { en: "Wheat", bg: "Пшеница" }, stat: "0.58", status: "alert" as const },
	{ swatch: "#5a9968", name: "A-202", ha: "35 ha", crop: { en: "Sunflower", bg: "Слънчоглед" }, stat: "0.76", status: "healthy" as const },
	{ swatch: "#97c459", name: "A-203", ha: "28 ha", crop: { en: "Rapeseed", bg: "Рапица" }, stat: "0.71", status: "ok" as const },
];

const copy = {
	en: {
		side: {
			daily: "Daily",
			mesh: "Mesh",
			more: "More",
			items: {
				briefing: "Briefing",
				fields: "Fields",
				market: "Market",
				finance: "Finance",
				agents: "Agents",
				ask: "Ask AgriNexus",
				academy: "Academy",
				settings: "Settings",
			},
			userMeta: "Dobrich · 280 ha",
		},
		greeting: "Good morning,",
		date: "Friday · 22 May 2026 · 06:42 EET",
		search: "Ask anything…",
		briefings: [
			{ tag: "MARKET", meta: "4 agents consulted", text: <>Wheat opened <span className="text-semantic-success font-medium">+2.4%</span>. Your 60t at <strong className="font-medium">€246</strong> · this is a strong forward window.</>, cta: "See full analysis", tagClass: "bg-forest-700/10 text-forest-700" },
			{ tag: "FIELD", meta: "SatelliteAgent", text: <>NDVI drop in <strong className="font-medium">Field A-204, south block</strong>. Possible early septoria · drone scout dispatched.</>, cta: "See the stress zone", tagClass: "bg-earth-600/15 text-harvest-700" },
			{ tag: "OPS", meta: "WeatherAgent + IrrigationAgent", text: <>14mm rain at <strong className="font-medium">17:00</strong> · irrigation paused, pump rerouted to greenhouse 2.</>, cta: "See forecast", tagClass: "bg-semantic-info/[0.12] text-semantic-info" },
		],
		fieldsTitle: "Your fields",
		fieldTabs: ["NDVI", "Moisture", "Yield est."],
		status: { healthy: "Healthy", alert: "Stress", ok: "Watching" },
		mapLabel: "A-204 · 2.3 ha",
		marketTitle: "Market positions",
		marketMeta: "MATIF · 06:42 live",
		wheatMeta: "WHEAT · DEC26 · 480t reserve",
		forecast: "Forecast · Sep 30",
		overCost: "+€84/t over break-even",
		lock: "Lock 144t",
		wait: "Wait",
		activityTitle: "Agent activity",
		activityMeta: "last 6h · 23 actions",
		activity: [
			{ icon: "📈", tag: "MKT", time: "06:42", text: <>Wheat <strong className="font-medium">+2.4%</strong> · forward window flagged</>, statusText: "⏵ Awaiting your tap", done: false },
			{ icon: "💧", tag: "IRR", time: "06:18", text: <>Paused irrigation on <strong className="font-medium">A-204</strong> · rain at 17:00</>, statusText: "✓ Executed (L4 autonomy)", done: true },
			{ icon: "🛰️", tag: "SAT", time: "05:50", text: <>NDVI drop in <strong className="font-medium">A-204 south</strong> · 2.3 ha flagged</>, statusText: "✓ Drone dispatched", done: true },
			{ icon: "🦠", tag: "DIS", time: "04:12", text: <>Septoria probability <strong className="font-medium">78%</strong> · scout report queued</>, statusText: "⏵ Confirm treatment plan", done: false },
		],
		weatherTitle: "Weather · Dobrich",
		weatherMeta: "7-day · hyper-local",
		weather: [
			{ dow: "Today", icon: "🌧", high: "22°", low: "14°", rain: "14mm", today: true },
			{ dow: "Sat", icon: "☁", high: "19°", low: "12°", rain: "2mm" },
			{ dow: "Sun", icon: "⛅", high: "23°", low: "13°", rain: "—" },
			{ dow: "Mon", icon: "☀", high: "26°", low: "15°", rain: "—" },
			{ dow: "Tue", icon: "⛈", high: "21°", low: "14°", rain: "28mm" },
		],
		tasksTitle: "Today's tasks",
		tasksMeta: "3 from agents · 1 from you",
		tasks: [
			{ done: false, title: "Confirm septoria treatment for A-204", meta: "Due 11:00 · before rain", from: "DIS" },
			{ done: false, title: "Approve 144t wheat forward at €246", meta: "Window closes 16:00", from: "MKT" },
			{ done: true, title: "Review weekly sustainability report", meta: "Done · 06:15", from: "CO2" },
			{ done: false, title: "Call Stefan about combine maintenance", meta: "Self-added · this week", from: "YOU" },
		],
		links: { mobile: "📱 View mobile version", home: "← Home" },
	},
	bg: {
		side: {
			daily: "Дневно",
			mesh: "Мрежа",
			more: "Още",
			items: {
				briefing: "Обзор",
				fields: "Поля",
				market: "Пазар",
				finance: "Финанси",
				agents: "Агенти",
				ask: "Попитай AgriNexus",
				academy: "Академия",
				settings: "Настройки",
			},
			userMeta: "Добрич · 280 ха",
		},
		greeting: "Добро утро,",
		date: "Петък · 22 май 2026 · 06:42 EET",
		search: "Попитай каквото и да е…",
		briefings: [
			{ tag: "ПАЗАР", meta: "4 агента консултирани", text: <>Пшеницата отвори <span className="text-semantic-success font-medium">+2.4%</span>. Твоите 60 т при <strong className="font-medium">€246</strong> · силен forward прозорец.</>, cta: "Виж пълния анализ", tagClass: "bg-forest-700/10 text-forest-700" },
			{ tag: "ПОЛЕ", meta: "SatelliteAgent", text: <>NDVI спад в <strong className="font-medium">поле A-204, южен блок</strong>. Възможна ранна септория · изпратен дрон.</>, cta: "Виж стрес зоната", tagClass: "bg-earth-600/15 text-harvest-700" },
			{ tag: "ОПЕР.", meta: "WeatherAgent + IrrigationAgent", text: <>14 мм дъжд в <strong className="font-medium">17:00</strong> · напояването е паузирано, помпата е пренасочена.</>, cta: "Виж прогнозата", tagClass: "bg-semantic-info/[0.12] text-semantic-info" },
		],
		fieldsTitle: "Твоите полета",
		fieldTabs: ["NDVI", "Влага", "Оценка добив"],
		status: { healthy: "Здраво", alert: "Стрес", ok: "Следене" },
		mapLabel: "A-204 · 2.3 ха",
		marketTitle: "Пазарни позиции",
		marketMeta: "MATIF · 06:42 на живо",
		wheatMeta: "ПШЕНИЦА · DEC26 · 480 т резерв",
		forecast: "Прогноза · 30 сеп",
		overCost: "+€84/т над себестойност",
		lock: "Заключи 144 т",
		wait: "Изчакай",
		activityTitle: "Активност на агенти",
		activityMeta: "последни 6 ч · 23 действия",
		activity: [
			{ icon: "📈", tag: "MKT", time: "06:42", text: <>Пшеница <strong className="font-medium">+2.4%</strong> · маркиран forward прозорец</>, statusText: "⏵ Чака твое потвърждение", done: false },
			{ icon: "💧", tag: "IRR", time: "06:18", text: <>Напояването на <strong className="font-medium">A-204</strong> е паузирано · дъжд в 17:00</>, statusText: "✓ Изпълнено (L4 автономност)", done: true },
			{ icon: "🛰️", tag: "SAT", time: "05:50", text: <>NDVI спад в <strong className="font-medium">A-204 юг</strong> · 2.3 ха маркирани</>, statusText: "✓ Дронът е изпратен", done: true },
			{ icon: "🦠", tag: "DIS", time: "04:12", text: <>Вероятност за септория <strong className="font-medium">78%</strong> · scout отчетът е готов</>, statusText: "⏵ Потвърди план за третиране", done: false },
		],
		weatherTitle: "Време · Добрич",
		weatherMeta: "7 дни · локално",
		weather: [
			{ dow: "Днес", icon: "🌧", high: "22°", low: "14°", rain: "14 мм", today: true },
			{ dow: "Съб", icon: "☁", high: "19°", low: "12°", rain: "2 мм" },
			{ dow: "Нед", icon: "⛅", high: "23°", low: "13°", rain: "—" },
			{ dow: "Пон", icon: "☀", high: "26°", low: "15°", rain: "—" },
			{ dow: "Вто", icon: "⛈", high: "21°", low: "14°", rain: "28 мм" },
		],
		tasksTitle: "Задачи за днес",
		tasksMeta: "3 от агенти · 1 от теб",
		tasks: [
			{ done: false, title: "Потвърди третиране срещу септория за A-204", meta: "До 11:00 · преди дъжда", from: "DIS" },
			{ done: false, title: "Одобри 144 т пшеница forward при €246", meta: "Прозорецът затваря 16:00", from: "MKT" },
			{ done: true, title: "Прегледай седмичния sustainability отчет", meta: "Готово · 06:15", from: "CO2" },
			{ done: false, title: "Обади се на Стефан за профилактика на комбайна", meta: "Добавено от теб · тази седмица", from: "ТИ" },
		],
		links: { mobile: "📱 Виж мобилна версия", home: "← Начало" },
	},
};



export default async function DashboardPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	const supabase = createClient();
	const { data: { session } } = await supabase.auth.getSession();
	
	let profile = null;
	let userFields = null;

	let diaryEntries: DecisionDiaryEntry[] = [];

	if (session) {
		const [{ data: pData }, { data: fData }, { data: diaryRows }] = await Promise.all([
			supabase.from("farm_profiles").select("*").eq("user_id", session.user.id).single(),
			supabase.from("fields").select("*").eq("user_id", session.user.id),
			supabase
				.from("decision_diary_entries")
				.select("*")
				.eq("user_id", session.user.id)
				.order("decided_at", { ascending: false })
				.limit(5),
		]);
		profile = pData;
		userFields = fData;
		diaryEntries = (diaryRows ?? [])
			.map((row) => parseDecisionRow(row as Record<string, unknown>))
			.filter((e): e is DecisionDiaryEntry => e != null);
	}

	const userName = profile?.full_name || session?.user?.email?.split('@')[0] || "User";
	const initials = userName.substring(0, 2).toUpperCase();
	const userRegion = profile?.region || "Unknown";
	const userHa = profile?.total_ha || "0";
	const userMeta = `${userRegion} · ${userHa} ${locale === "bg" ? "ха" : "ha"}`;
	const breakEvenInputs = parseBreakEvenInputs(profile?.break_even_inputs);
	const totalHa = Number(profile?.total_ha) || 0;

	// Ако потребителят има свои полета, ги ползваме, иначе показваме примерните (defaultFields)
	const fields = userFields && userFields.length > 0 
		? userFields.map((f: any, i: number) => ({
				swatch: ["#1f4d2c", "#c4a86a", "#5a9968", "#97c459"][i % 4],
				name: f.name,
				ha: `${f.hectares} ${locale === "bg" ? "ха" : "ha"}`,
				crop: { bg: f.crop, en: f.crop },
				stat: (0.5 + Math.random() * 0.4).toFixed(2), // Временно генериран NDVI
				status: (f.status || "healthy") as "healthy" | "alert" | "ok"
		  }))
		: defaultFields;
	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12">
				<div className="mb-4 flex items-center justify-between md:mb-5">
					<div>
						<div className="font-serif text-xl font-normal leading-[1.1] tracking-[-0.015em] md:text-[26px]">{c.greeting} <em className="grad-text">{userName.split(' ')[0]}.</em></div>
						<div className="mt-1 font-mono text-[11px] text-ink/50">{c.date}</div>
					</div>
					<div className="hidden items-center gap-2 md:flex">
						<Link
							href="/dashboard/ask"
							className="hidden min-w-[220px] items-center gap-2 rounded-full border border-ink/[0.06] bg-white/65 px-3.5 py-2 text-xs text-ink/50 backdrop-blur-md no-underline transition-colors hover:border-forest-700/25 hover:text-forest-800 lg:flex"
						>
							<span>{c.search}</span>
							<span className="ml-auto rounded border border-ink/15 px-1.5 py-px font-mono text-[9px]">💬</span>
						</Link>
						<div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-ink/[0.06] bg-white/65 text-sm backdrop-blur-md">🔔<span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border-[1.5px] border-[#f6f3ec] bg-semantic-warning" /></div>
					</div>
				</div>

				<div className="mb-5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_280px]">
					<BreakEvenProfitCard locale={locale} inputs={breakEvenInputs} totalHa={totalHa} />
					<DecisionDiaryTeaser locale={locale} entries={diaryEntries} />
				</div>

				<section className="mb-3.5 grid grid-cols-1 gap-5 rounded-[18px] border border-white/70 bg-white/55 px-4 py-4 backdrop-blur-xl md:px-6 md:py-5 md:grid-cols-3">
					{c.briefings.map((briefing, idx) => (
						<div key={briefing.tag} className={idx < c.briefings.length - 1 ? "border-ink/[0.06] md:border-r md:pr-4" : ""}>
							<div className="mb-2.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.08em] text-ink/50">
								<span className={`rounded px-1.5 py-0.5 font-mono font-medium tracking-[0.06em] ${briefing.tagClass}`}>{briefing.tag}</span>
								<span>{briefing.meta}</span>
							</div>
							<div className="mb-2.5 text-[13.5px] leading-[1.45] text-ink">{briefing.text}</div>
							<span className="cursor-pointer text-[11px] font-medium text-forest-700">{briefing.cta} →</span>
						</div>
					))}
				</section>

				<div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
					<div className="flex flex-col gap-3.5">
						<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl">
							<div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5">
								<div className="text-[13px] font-medium">{c.fieldsTitle}</div>
								<div className="flex gap-1">
									{c.fieldTabs.map((tab, i) => <span key={tab} className={`rounded-md px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] ${i === 0 ? "bg-ink text-white" : "text-ink/50"}`}>{tab}</span>)}
								</div>
							</div>
							<div className="mx-4 mb-3 mt-2 h-[230px] overflow-hidden rounded-xl">
								<svg viewBox="0 0 460 230" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="h-full w-full">
									<rect width="460" height="230" fill="rgba(31,77,44,0.04)" />
									<path d="M 20 20 L 140 25 L 145 90 L 25 95 Z" fill="#5a9968" opacity="0.55" />
									<path d="M 145 25 L 270 28 L 268 88 L 145 90 Z" fill="#7fb487" opacity="0.6" />
									<path d="M 268 28 L 380 30 L 382 95 L 268 88 Z" fill="#97c459" opacity="0.55" />
									<path d="M 25 95 L 145 90 L 150 165 L 28 170 Z" fill="#1f4d2c" opacity="0.55" />
									<path d="M 145 90 L 268 88 L 270 168 L 150 165 Z" fill="#5a9968" opacity="0.5" />
									<path d="M 268 88 L 382 95 L 384 175 L 270 168 Z" fill="#c4a86a" opacity="0.5" />
									<circle cx="335" cy="135" r="5" fill="#b87a3d" />
									<rect x="291" y="103" width="86" height="18" rx="3" fill="rgba(184,122,61,0.95)" />
									<text x="334" y="116" textAnchor="middle" fontSize="9" fill="white" fontFamily="ui-monospace,monospace" fontWeight="500">{c.mapLabel}</text>
								</svg>
							</div>
							<div className="mx-4 mb-4 flex flex-col gap-px overflow-hidden rounded-[10px] bg-ink/[0.04] px-4 pb-4">
								{fields.map((field) => (
									<div key={field.name} className="grid cursor-pointer grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2.5 bg-[rgba(252,251,247,0.95)] px-3.5 py-2.5 text-xs">
										<div className="h-2.5 w-2.5 rounded-sm" style={{ background: field.swatch }} />
										<div className="font-medium">{field.name} <span className="ml-1.5 text-[11px] font-normal text-ink/45">{field.ha}</span></div>
										<div className="text-[11px] text-ink/55">{field.crop[locale === "bg" ? "bg" : "en"]}</div>
										<div className="font-mono text-[11px] text-ink/70">{field.stat}</div>
										<span className={`rounded px-2 py-px text-[10px] font-medium ${field.status === "healthy" ? "bg-forest-700/10 text-forest-700" : field.status === "alert" ? "bg-earth-600/15 text-harvest-700" : "bg-ink/[0.06] text-ink/50"}`}>{c.status[field.status as keyof typeof c.status]}</span>
									</div>
								))}
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl">
							<div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5"><div className="text-[13px] font-medium">{c.marketTitle}</div><div className="font-mono text-[10px] text-ink/50">{c.marketMeta}</div></div>
							<div className="grid grid-cols-1 gap-3.5 px-4 pb-5 py-1 md:grid-cols-2">
								<div><div className="mb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/50">{c.wheatMeta}</div><div className="mb-1 flex items-baseline gap-2"><span className="font-serif text-3xl tracking-[-0.02em]">€246</span><span className="text-[11px] font-medium text-semantic-success">+€8</span></div></div>
								<div><div className="rounded-lg border border-forest-700/10 bg-forest-700/[0.06] px-3 py-2.5"><div className="mb-1 text-[9px] uppercase tracking-[0.06em] text-ink/50">{c.forecast}</div><div className="font-serif text-base text-forest-700">€268 ±€14</div><div className="text-[10px] text-forest-700/70">{c.overCost}</div></div><div className="flex gap-1.5 pt-3"><button className="flex-1 rounded-lg border-none bg-ink px-2.5 py-2 text-center text-[11px] font-medium text-white">{c.lock}</button><button className="flex-1 rounded-lg border border-ink/[0.18] bg-transparent px-2.5 py-2 text-center text-[11px] font-medium text-ink/65">{c.wait}</button></div></div>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-3.5">
						<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl">
							<div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5"><div className="text-[13px] font-medium">{c.activityTitle}</div><div className="font-mono text-[10px] text-ink/50">{c.activityMeta}</div></div>
							<div className="px-4 pb-4">
								{c.activity.map((item, idx) => (
									<div key={idx} className="flex gap-2.5 border-b border-ink/[0.05] py-2.5 last:border-b-0">
										<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-ink/[0.06] bg-white/60 text-[11px]">{item.icon}</div>
										<div className="flex-1"><div className="mb-0.5 flex items-center gap-2"><span className="rounded-sm bg-ink/[0.04] px-1.5 py-px font-mono text-[9px] tracking-[0.06em] text-ink/50">{item.tag}</span><span className="text-[10px] text-ink/40">{item.time}</span></div><div className="text-xs leading-[1.4]">{item.text}</div><div className={`mt-1 text-[10px] ${item.done ? "text-semantic-success" : "text-harvest-700"}`}>{item.statusText}</div></div>
									</div>
								))}
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl">
							<div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5"><div className="text-[13px] font-medium">{c.weatherTitle}</div><div className="font-mono text-[10px] text-ink/50">{c.weatherMeta}</div></div>
							<div className="grid grid-cols-5">
								{c.weather.map((day) => <div key={day.dow} className={`border-r border-ink/[0.05] px-1.5 py-3 text-center last:border-r-0 ${day.today ? "bg-forest-700/[0.04]" : ""}`}><div className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/50">{day.dow}</div><div className="mb-1.5 text-[22px]">{day.icon}</div><div className="mb-1 text-[13px] font-medium">{day.high}<span className="text-[11px] font-normal text-ink/40"> / {day.low}</span></div><div className="text-[10px] text-semantic-info">{day.rain}</div></div>)}
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl">
							<div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5"><div className="text-[13px] font-medium">{c.tasksTitle}</div><div className="font-mono text-[10px] text-ink/50">{c.tasksMeta}</div></div>
							<div className="flex flex-col gap-1.5 px-4 pb-4">
								{c.tasks.map((task, idx) => <div key={idx} className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/50 px-2.5 py-2"><span className={`relative h-3.5 w-3.5 flex-shrink-0 rounded ${task.done ? "border border-forest-700 bg-gradient-to-br from-forest-700 to-forest-500" : "border border-ink/25"}`}>{task.done && <span className="absolute left-1 top-[2px] h-[7px] w-1 rotate-45 border-b-[1.5px] border-r-[1.5px] border-white" />}</span><div className="flex-1"><div className={`text-xs ${task.done ? "text-ink/40 line-through" : ""}`}>{task.title}</div><div className="mt-px text-[10px] text-ink/45">{task.meta}</div></div><span className="ml-auto rounded-sm bg-ink/[0.04] px-1.5 py-px font-mono text-[9px] tracking-[0.04em] text-ink/55">{task.from}</span></div>)}
							</div>
						</div>
					</div>
				</div>

				<div className="hidden py-5 text-center text-[11px] text-ink/40 md:block">
					<Link href="/" className="hover:text-ink">{c.links.home}</Link>
				</div>
		</div>
	);
}
