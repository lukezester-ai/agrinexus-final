import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? { title: "Табло · Мобилно", description: "Мобилен преглед на таблото AgriNexus." }
		: { title: "Dashboard · Mobile", description: "AgriNexus mobile dashboard preview." };
}

const copy = {
	en: {
		greeting: "Good morning,",
		date: "Fri 22 May · Dobrich",
		briefing: "Today's briefing",
		live: "Live",
		briefs: [
			{ tag: "MKT", cls: "bg-forest-700/12 text-forest-700", text: <>Wheat <span className="text-semantic-success font-medium">+2.4%</span>. Strong forward window at <strong className="font-medium">€246</strong>.</> },
			{ tag: "FLD", cls: "bg-earth-600/[0.18] text-harvest-700", text: <>Stress zone in <strong className="font-medium">A-204 south</strong>. Possible septoria.</> },
			{ tag: "OPS", cls: "bg-white/60 text-ink/60", text: <>14mm rain at 17:00. Irrigation paused.</> },
		],
		needsTitle: "Needs you",
		actionsCount: "2 actions",
		needs: [
			{ icon: "🦠", meta: "DISEASE · 11:00 deadline", title: "Confirm septoria treatment for A-204", actions: [{ label: "Approve", primary: true }, { label: "Review", primary: false }] },
			{ icon: "📈", meta: "MARKET · closes 16:00", title: "Lock 144t wheat forward", sub: "at €246 · +€84 over break-even", actions: [{ label: "Lock at €246", primary: true }, { label: "Wait", primary: false }] },
		],
		fieldsTitle: "Fields",
		fieldsTotal: "8 total →",
		fields: [
			{ color: "var(--c-warning)", name: "A-204", meta: "· 87 ha · wheat", statText: "NDVI 0.58 · stress zone 2.3 ha", statClass: "text-semantic-warning" },
			{ color: "#2D7A3F", name: "A-205", meta: "· 42 ha · wheat", statText: "NDVI 0.84 · healthy", statClass: "text-semantic-success" },
			{ color: "#2D7A3F", name: "A-202", meta: "· 35 ha · sunflower", statText: "NDVI 0.76 · healthy", statClass: "text-semantic-success" },
		],
		weatherTitle: "Weather",
		weatherMeta: "Dobrich · hyper-local",
		weather: [
			{ dow: "TODAY", icon: "🌧", t: "22°", r: "14mm", today: true },
			{ dow: "SAT", icon: "☁", t: "19°", r: "2mm" },
			{ dow: "SUN", icon: "☀", t: "23°", r: "—" },
			{ dow: "MON", icon: "☀", t: "26°", r: "—" },
		],
		activityTitle: "Agent activity",
		activityMeta: "last 6h",
		activity: [
			{ tag: "IRR", tagClass: "bg-semantic-success/[0.12] text-semantic-success", text: "Paused A-204 irrigation · rain incoming", sub: "06:18 · auto-executed", subClass: "text-ink/45" },
			{ tag: "SAT", tagClass: "bg-semantic-info/[0.12] text-semantic-info", text: "NDVI drop in A-204 south · drone sent", sub: "05:50 · auto-executed", subClass: "text-ink/45" },
			{ tag: "DIS", tagClass: "bg-earth-600/[0.18] text-semantic-warning", text: "Septoria 78% probability · awaiting you", sub: "04:12 · pending", subClass: "text-semantic-warning" },
		],
		ask: "🎙 Ask AgriNexus",
		tabs: ["Today", "Fields", "Market", "More"],
		desktop: "🖥 View desktop version",
		home: "← Home",
	},
	bg: {
		greeting: "Добро утро,",
		date: "Петък, 22 май · Добрич",
		briefing: "Днешен briefing",
		live: "На живо",
		briefs: [
			{ tag: "MKT", cls: "bg-forest-700/12 text-forest-700", text: <>Пшеницата е <span className="text-semantic-success font-medium">+2.4%</span>. Силен forward прозорец при <strong className="font-medium">€246</strong>.</> },
			{ tag: "FLD", cls: "bg-earth-600/[0.18] text-harvest-700", text: <>Стрес зона в <strong className="font-medium">A-204 юг</strong>. Възможна септория.</> },
			{ tag: "OPS", cls: "bg-white/60 text-ink/60", text: <>14 мм дъжд в 17:00. Напояването е паузирано.</> },
		],
		needsTitle: "Изисква решение",
		actionsCount: "2 действия",
		needs: [
			{ icon: "🦠", meta: "БОЛЕСТ · срок 11:00", title: "Потвърди третиране срещу септория за A-204", actions: [{ label: "Одобри", primary: true }, { label: "Преглед", primary: false }] },
			{ icon: "📈", meta: "ПАЗАР · до 16:00", title: "Заключи forward за 144 т пшеница", sub: "при €246 · +€84 над себестойност", actions: [{ label: "Заключи €246", primary: true }, { label: "Изчакай", primary: false }] },
		],
		fieldsTitle: "Поля",
		fieldsTotal: "общо 8 →",
		fields: [
			{ color: "var(--c-warning)", name: "A-204", meta: "· 87 ха · пшеница", statText: "NDVI 0.58 · стрес зона 2.3 ха", statClass: "text-semantic-warning" },
			{ color: "#2D7A3F", name: "A-205", meta: "· 42 ха · пшеница", statText: "NDVI 0.84 · здраво", statClass: "text-semantic-success" },
			{ color: "#2D7A3F", name: "A-202", meta: "· 35 ха · слънчоглед", statText: "NDVI 0.76 · здраво", statClass: "text-semantic-success" },
		],
		weatherTitle: "Време",
		weatherMeta: "Добрич · локално",
		weather: [
			{ dow: "ДНЕС", icon: "🌧", t: "22°", r: "14 мм", today: true },
			{ dow: "СЪБ", icon: "☁", t: "19°", r: "2 мм" },
			{ dow: "НЕД", icon: "☀", t: "23°", r: "—" },
			{ dow: "ПОН", icon: "☀", t: "26°", r: "—" },
		],
		activityTitle: "Активност на агенти",
		activityMeta: "последни 6 ч",
		activity: [
			{ tag: "IRR", tagClass: "bg-semantic-success/[0.12] text-semantic-success", text: "Напояването на A-204 е паузирано · идва дъжд", sub: "06:18 · изпълнено автоматично", subClass: "text-ink/45" },
			{ tag: "SAT", tagClass: "bg-semantic-info/[0.12] text-semantic-info", text: "NDVI спад в A-204 юг · изпратен дрон", sub: "05:50 · изпълнено автоматично", subClass: "text-ink/45" },
			{ tag: "DIS", tagClass: "bg-earth-600/[0.18] text-semantic-warning", text: "78% вероятност за септория · чака теб", sub: "04:12 · чака одобрение", subClass: "text-semantic-warning" },
		],
		ask: "🎙 Попитай AgriNexus",
		tabs: ["Днес", "Поля", "Пазар", "Още"],
		desktop: "🖥 Виж desktop версия",
		home: "← Начало",
	},
};

export default async function DashboardMobilePage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<div className="relative z-[2] flex min-h-screen justify-center bg-[#e8e3d5] p-3.5">
			<div className="w-[380px] max-w-full overflow-hidden rounded-[32px] border border-ink/[0.06] bg-paper shadow-[0_30px_60px_-20px_rgba(10,10,10,0.25)]">
				<div className="flex justify-center pb-1 pt-2.5">
					<div className="h-1.5 w-[110px] rounded-full bg-ink/[0.18]" />
				</div>
				<div className="flex items-center justify-between px-[22px] pb-1.5 pt-2.5 text-xs">
					<div className="font-medium">06:42</div>
					<div className="flex gap-1.5 text-xs opacity-60"><span>📶</span><span>🔋</span></div>
				</div>
				<div className="flex items-start justify-between px-[22px] pb-5 pt-4">
					<div>
						<div className="font-serif text-[22px] font-medium leading-[1.15]">{c.greeting}<br />Marko.</div>
						<div className="mt-1 text-xs text-ink/50">{c.date}</div>
					</div>
					<div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-semantic-info/[0.12] text-sm font-medium text-semantic-info">
						MP<span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-[2.5px] border-paper bg-semantic-warning" />
					</div>
				</div>

				<div className="mx-4 mb-4 rounded-2xl border border-ink/[0.05] bg-semantic-info/[0.08] p-4">
					<div className="mb-3.5 flex items-center justify-between">
						<div className="text-[11px] font-medium uppercase tracking-[0.06em] text-semantic-info">{c.briefing}</div>
						<div className="flex items-center gap-1.5 text-[11px] text-semantic-info"><span className="h-1.5 w-1.5 rounded-full bg-semantic-success" />{c.live}</div>
					</div>
					<div className="flex flex-col gap-3">
						{c.briefs.map((b) => (
							<div key={b.tag} className="flex items-start gap-2.5">
								<span className={`mt-px flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.04em] ${b.cls}`}>{b.tag}</span>
								<div className="text-[13px] leading-[1.45] text-semantic-info">{b.text}</div>
							</div>
						))}
					</div>
				</div>

				<div className="flex items-baseline justify-between px-4 pb-3"><div className="text-[13px] font-medium">{c.needsTitle}</div><div className="text-xs text-ink/40">{c.actionsCount}</div></div>
				<div className="flex flex-col gap-2.5 px-4 pb-4">
					{c.needs.map((need) => (
						<div key={need.title} className="rounded-2xl border border-ink/[0.06] bg-[#fcfbf7] p-3.5">
							<div className="mb-2 flex items-center gap-2"><span className="text-lg">{need.icon}</span><span className="font-mono text-[11px] tracking-[0.04em] text-ink/50">{need.meta}</span></div>
							<div className="mb-1 text-sm font-medium leading-[1.35]">{need.title}</div>
							{need.sub && <div className="mb-2.5 text-xs text-ink/65">{need.sub}</div>}
							<div className="flex gap-2">
								{need.actions.map((action) => (
									<button key={action.label} className={`min-h-[38px] flex-1 rounded-[10px] text-[13px] font-medium ${action.primary ? "border-none bg-ink text-white" : "border border-ink/[0.18] bg-transparent text-ink"}`}>
										{action.label}
									</button>
								))}
							</div>
						</div>
					))}
				</div>

				<div className="flex items-baseline justify-between px-4 pb-3"><div className="text-[13px] font-medium">{c.fieldsTitle}</div><div className="text-xs text-ink/40">{c.fieldsTotal}</div></div>
				<div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-ink/[0.06] bg-[#fcfbf7]">
					{c.fields.map((field) => (
						<div key={field.name} className="flex cursor-pointer items-center gap-3 border-b border-ink/[0.05] p-3.5 last:border-b-0">
							<div className="h-9 w-2 flex-shrink-0 rounded-sm" style={{ background: field.color }} />
							<div className="flex-1"><div className="text-[13px] font-medium">{field.name} <span className="ml-1 text-[11px] font-normal text-ink/45">{field.meta}</span></div><div className={`mt-px text-[11px] ${field.statClass}`}>{field.statText}</div></div>
							<div className="text-sm text-ink/35">›</div>
						</div>
					))}
				</div>

				<div className="flex items-baseline justify-between px-4 pb-3"><div className="text-[13px] font-medium">{c.weatherTitle}</div><div className="text-xs text-ink/40">{c.weatherMeta}</div></div>
				<div className="mx-4 mb-4 flex justify-between gap-1.5 rounded-2xl border border-ink/[0.06] bg-[#fcfbf7] p-3.5">
					{c.weather.map((day) => (
						<div key={day.dow} className={`flex-1 rounded-[10px] py-1 text-center ${day.today ? "bg-semantic-info/[0.08]" : ""}`}>
							<div className={`mb-1 font-mono text-[10px] font-medium ${day.today ? "text-semantic-info" : "text-ink/50"}`}>{day.dow}</div>
							<div className="mb-1 text-[22px]">{day.icon}</div>
							<div className="text-[13px] font-medium">{day.t}</div>
							<div className="text-[10px] text-ink/45">{day.r}</div>
						</div>
					))}
				</div>

				<div className="flex items-baseline justify-between px-4 pb-3"><div className="text-[13px] font-medium">{c.activityTitle}</div><div className="text-xs text-ink/40">{c.activityMeta}</div></div>
				<div className="mx-4 mb-4 rounded-2xl border border-ink/[0.06] bg-[#fcfbf7] px-3.5 py-3">
					{c.activity.map((activity, idx) => (
						<div key={idx} className="flex gap-2.5 border-b border-ink/[0.05] py-2 last:border-b-0">
							<span className={`h-fit flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.04em] ${activity.tagClass}`}>{activity.tag}</span>
							<div className="flex-1 text-xs leading-[1.45]">{activity.text}<div className={`mt-0.5 text-[10px] ${activity.subClass}`}>{activity.sub}</div></div>
						</div>
					))}
				</div>

				<button className="mx-4 mb-4 flex min-h-[52px] w-[calc(100%-32px)] items-center justify-center gap-2.5 rounded-full border-none bg-ink text-sm font-medium text-white">
					{c.ask}
				</button>
				<div className="grid grid-cols-4 border-t border-ink/[0.06] bg-[#fcfbf7]">
					{[
						["#", "🏠", c.tabs[0], "text-ink font-medium"],
						["#", "📋", c.tabs[1], "text-ink/40"],
						["/market", "📈", c.tabs[2], "text-ink/40"],
						["#", "⋯", c.tabs[3], "text-ink/40"],
					].map(([href, icon, label, cls]) => (
						<Link key={label} href={href} className={`flex flex-col items-center gap-1 py-3 pb-4 text-center no-underline ${cls}`}>
							<span className="text-[22px]">{icon}</span><span className="text-[10px]">{label}</span>
						</Link>
					))}
				</div>
			</div>

			<div className="absolute bottom-3 w-full text-center text-[11px] text-ink/40">
				<Link href="/dashboard" className="hover:text-ink">{c.desktop}</Link> · <Link href="/" className="hover:text-ink">{c.home}</Link>
			</div>
		</div>
	);
}
