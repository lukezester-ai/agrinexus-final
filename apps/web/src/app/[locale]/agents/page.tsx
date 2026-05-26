import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "AgentsMeta" });
	return { title: t("title"), description: t("description") };
}

type AgentLevel = 1 | 2 | 3 | 4;
type Agent = {
	icon: string;
	name: string;
	tag: string;
	desc: string;
	level: AgentLevel;
};

type Group = { num: string; eyebrow: string; title: string; titleItalic: string; sub?: string; agents: Agent[] };

const copy = {
	en: {
		levelLabels: {
			1: "Advisor",
			2: "Co-pilot",
			3: "Auto-pilot",
			4: "Autonomous",
		} as Record<AgentLevel, string>,
		heroEyebrow: "// The agent mesh",
		heroLine1: "Eighteen specialists.",
		heroLine2Before: "One ",
		heroLine2Em: "thinking farm.",
		heroSubtitle:
			"AgriNexus isn't one AI — it's a coordinated team of 18. Each owns a domain. Each acts within bounds you set. Together, they run a farm that almost runs itself.",
		ladderEyebrow: "// Autonomy ladder",
		ladderTitleBefore: "You set how much ",
		ladderTitleEm: "they decide.",
		ladderSubtitle: "Each agent can operate at one of four levels. You raise the level as trust builds. Drop it anytime.",
		ladderDesc: {
			1: "Recommends only. You decide and execute.",
			2: "Executes after a single tap of confirmation.",
			3: "Acts within bounds you set. Reports after.",
			4: "Full ownership of its domain. Kill switch always on.",
		} as Record<AgentLevel, string>,
		groups: [
			{
				num: "01",
				eyebrow: "Crop Lifecycle",
				title: "Agents that",
				titleItalic: "grow the crop.",
				sub: "From planning rotations to feeding the soil, these four oversee the biological side of the farm.",
				agents: [
					{ icon: "📋", name: "Planning", tag: "PLN · The strategist", desc: "Recommends crop rotation, varieties, ROI scenarios for the season ahead.", level: 2 },
					{ icon: "🌱", name: "Seeding", tag: "SED · The sower", desc: "Optimal sowing dates from soil temperature, weather, lunar phase. Issues work orders.", level: 2 },
					{ icon: "💧", name: "Irrigation", tag: "IRR · The hydrologist", desc: "Real-time moisture monitoring, auto-controls drip systems, integrates ET models.", level: 4 },
					{ icon: "🧪", name: "Nutrition", tag: "NUT · The agrochemist", desc: "Reads soil samples + NDVI, recommends variable-rate fertilizer. Exports prescription maps.", level: 2 },
				],
			},
			{
				num: "02",
				eyebrow: "Monitoring & Detection",
				title: "Agents that",
				titleItalic: "watch the field.",
				sub: "Satellite eyes, plant-level computer vision, hyper-local weather — they spot problems before you do.",
				agents: [
					{ icon: "🛰️", name: "Satellite", tag: "SAT · Eye from space", desc: "Pulls Sentinel-2/Landsat, processes NDVI/NDWI/NDRE, weekly anomaly reports.", level: 4 },
					{ icon: "🦠", name: "Disease", tag: "DIS · Phytopathologist", desc: "CV on drone/phone photos. Identifies diseases & pests with probability scores.", level: 2 },
					{ icon: "🌾", name: "Weed scout", tag: "WDS · Weed botanist", desc: "Per-plant segmentation, generates spot-spray maps. Cuts herbicide by 60-90%.", level: 3 },
					{ icon: "🌦️", name: "Weather sentry", tag: "WTR · Meteorologist", desc: "Hyper-local forecasts, preventive alerts: hail, frost, storms — with action steps.", level: 4 },
				],
			},
			{
				num: "03",
				eyebrow: "Operations",
				title: "Agents that",
				titleItalic: "run the work.",
				agents: [
					{ icon: "🚜", name: "Fleet", tag: "FLT · The dispatcher", desc: "Routes tractors, combines, tankers. Predictive maintenance from telemetry.", level: 3 },
					{ icon: "👥", name: "Labor", tag: "LAB · HR coordinator", desc: "Assigns workers by urgency, skill, location. Tracks tasks via mobile.", level: 2 },
					{ icon: "📦", name: "Inventory", tag: "INV · Storekeeper", desc: "Tracks seeds, fertilizer, fuel, chemicals. Auto-orders at reorder point.", level: 3 },
				],
			},
			{
				num: "04",
				eyebrow: "Business & Compliance",
				title: "Agents that",
				titleItalic: "protect the margin.",
				agents: [
					{ icon: "📈", name: "Market", tag: "MKT · The trader", desc: "CBOT, MATIF, local prices. Forecasts 7/30/90d. Recommends sell & hedge windows.", level: 2 },
					{ icon: "📰", name: "News", tag: "NWS · The journalist", desc: "Reads 200+ sources nightly. Flags what affects your crop in plain language.", level: 4 },
					{ icon: "🛡️", name: "Compliance", tag: "CMP · The lawyer", desc: "Auto-fills CAP subsidy forms, audit trails, GAP / GlobalGAP cert prep.", level: 1 },
					{ icon: "🌍", name: "Carbon", tag: "CO2 · The ESG officer", desc: "Per-operation carbon footprint. Optimizes for credits. Generates MRV reports.", level: 2 },
					{ icon: "💰", name: "Finance", tag: "FIN · The CFO", desc: "Real-time P&L per field, cash flow forecasts, accountant-ready exports.", level: 1 },
				],
			},
			{
				num: "05",
				eyebrow: "Meta Layer",
				title: "Agents that",
				titleItalic: "think about thinking.",
				agents: [
					{ icon: "⚙️", name: "Orchestrator", tag: "ORC · The chief", desc: "Coordinates the mesh, resolves conflicts, escalates only critical decisions to you.", level: 4 },
					{ icon: "💬", name: "Conversation", tag: "CNV · Personal assistant", desc: "Your voice / chat entry point. Routes & aggregates.", level: 4 },
					{ icon: "🎓", name: "Learning", tag: "LRN · The scientist", desc: "Studies what worked. Updates models. Federated learning across farms (anonymized).", level: 4 },
				],
			},
		] satisfies Group[],
	},
	bg: {
		levelLabels: {
			1: "Съветник",
			2: "Ко-пилот",
			3: "Автопилот",
			4: "Автономен",
		} as Record<AgentLevel, string>,
		heroEyebrow: "// Мрежа от агенти",
		heroLine1: "Осемнадесет специалиста.",
		heroLine2Before: "Една ",
		heroLine2Em: "мислеща ферма.",
		heroSubtitle:
			"AgriNexus не е един AI, а координиран екип от 18 агента. Всеки има своя област, действа в зададени от теб граници и заедно поддържат стопанство, което почти се управлява само.",
		ladderEyebrow: "// Нива на автономност",
		ladderTitleBefore: "Ти задаваш колко ",
		ladderTitleEm: "могат да решават.",
		ladderSubtitle: "Всеки агент работи на едно от четири нива. Повишаваш нивото, когато доверието расте, и го сваляш по всяко време.",
		ladderDesc: {
			1: "Само препоръчва. Ти решаваш и изпълняваш.",
			2: "Изпълнява след едно потвърждение от теб.",
			3: "Действа в зададени граници и докладва след това.",
			4: "Поема цялата си област. Авариен стоп винаги остава активен.",
		} as Record<AgentLevel, string>,
		groups: [
			{
				num: "01",
				eyebrow: "Жизнен цикъл на културата",
				title: "Агенти, които",
				titleItalic: "отглеждат културата.",
				sub: "От планиране на сеитбооборота до подхранване на почвата, тези четири агента следят биологичната страна на стопанството.",
				agents: [
					{ icon: "📋", name: "Планиране", tag: "PLN · Стратегът", desc: "Предлага сеитбооборот, сортове и ROI сценарии за сезона напред.", level: 2 },
					{ icon: "🌱", name: "Сеитба", tag: "SED · Сеячът", desc: "Оценява срокове за сеитба според почвена температура, време и работни прозорци.", level: 2 },
					{ icon: "💧", name: "Напояване", tag: "IRR · Хидрологът", desc: "Следи влагата в реално време, управлява капково напояване и ET модели.", level: 4 },
					{ icon: "🧪", name: "Хранене", tag: "NUT · Агрохимикът", desc: "Чете почвени проби и NDVI, предлага променлива норма на торене и карти.", level: 2 },
				],
			},
			{
				num: "02",
				eyebrow: "Мониторинг и откриване",
				title: "Агенти, които",
				titleItalic: "наблюдават полето.",
				sub: "Сателитен поглед, компютърно зрение и локално време — проблемите се виждат преди да станат скъпи.",
				agents: [
					{ icon: "🛰️", name: "Сателит", tag: "SAT · Око от космоса", desc: "Обработва Sentinel-2/Landsat, NDVI/NDWI/NDRE и седмични аномалии.", level: 4 },
					{ icon: "🦠", name: "Болести", tag: "DIS · Фитопатологът", desc: "Работи с дрон/телефон снимки и дава вероятност за болести и неприятели.", level: 2 },
					{ icon: "🌾", name: "Плевели", tag: "WDS · Ботаникът", desc: "Сегментира растения и подготвя карти за точково третиране.", level: 3 },
					{ icon: "🌦️", name: "Време", tag: "WTR · Метеорологът", desc: "Локални прогнози и превантивни сигнали за градушка, слана и бури.", level: 4 },
				],
			},
			{
				num: "03",
				eyebrow: "Операции",
				title: "Агенти, които",
				titleItalic: "движат работата.",
				agents: [
					{ icon: "🚜", name: "Машини", tag: "FLT · Диспечерът", desc: "Планира трактори, комбайни и транспорт; следи профилактика по телеметрия.", level: 3 },
					{ icon: "👥", name: "Екип", tag: "LAB · Координаторът", desc: "Разпределя хора според спешност, умения и местоположение.", level: 2 },
					{ icon: "📦", name: "Склад", tag: "INV · Складовият агент", desc: "Следи семена, торове, гориво и препарати; подсеща за дозареждане.", level: 3 },
				],
			},
			{
				num: "04",
				eyebrow: "Бизнес и съответствие",
				title: "Агенти, които",
				titleItalic: "пазят маржа.",
				agents: [
					{ icon: "📈", name: "Пазар", tag: "MKT · Търговецът", desc: "Следи CBOT, MATIF и местни цени; обяснява прозорци за продажба и хеджиране.", level: 2 },
					{ icon: "📰", name: "Новини", tag: "NWS · Журналистът", desc: "Чете източници и отделя събитията, които засягат културата ти.", level: 4 },
					{ icon: "🛡️", name: "Съответствие", tag: "CMP · Юристът", desc: "Подготвя документи, следи одитни следи, GAP/GlobalGAP и субсидии.", level: 1 },
					{ icon: "🌍", name: "Въглерод", tag: "CO2 · ESG агентът", desc: "Изчислява отпечатък по операции и подготвя MRV отчети.", level: 2 },
					{ icon: "💰", name: "Финанси", tag: "FIN · Финансовият директор", desc: "P&L по поле, паричен поток и справки за счетоводител.", level: 1 },
				],
			},
			{
				num: "05",
				eyebrow: "Мета слой",
				title: "Агенти, които",
				titleItalic: "мислят за мисленето.",
				agents: [
					{ icon: "⚙️", name: "Оркестратор", tag: "ORC · Главният агент", desc: "Координира мрежата, решава конфликти и ескалира само критичното към теб.", level: 4 },
					{ icon: "💬", name: "Разговор", tag: "CNV · Личният асистент", desc: "Твоят вход през глас или чат. Маршрутизира и обобщава.", level: 4 },
					{ icon: "🎓", name: "Обучение", tag: "LRN · Ученият", desc: "Учи от резултатите и подобрява моделите, с анонимизирани данни.", level: 4 },
				],
			},
		] satisfies Group[],
	},
};

function AutonomyPips({ level }: { level: AgentLevel }) {
	return (
		<div className="flex gap-1">
			{[1, 2, 3, 4].map((i) => (
				<span key={i} className={i <= level ? "h-1.5 w-1.5 rounded-full bg-brand-gradient" : "h-1.5 w-1.5 rounded-full bg-ink/10"} />
			))}
		</div>
	);
}

function AgentCard({ a, levelLabels }: { a: Agent; levelLabels: Record<AgentLevel, string> }) {
	return (
		<div className="glass cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(31,77,44,0.18)]">
			<div className="mb-2.5 flex items-center gap-2.5">
				<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forest-700/[0.12] to-harvest-500/[0.12] text-base">
					{a.icon}
				</div>
				<div>
					<div className="text-[13px] font-medium leading-[1.1]">{a.name}</div>
					<div className="font-mono text-[9px] tracking-[0.06em] text-ink/40">{a.tag}</div>
				</div>
			</div>
			<div className="mb-2.5 min-h-[36px] text-[11.5px] leading-[1.45] text-ink/60">{a.desc}</div>
			<div className="flex items-center justify-between border-t border-ink/[0.06] pt-2.5">
				<AutonomyPips level={a.level} />
				<span className="font-mono text-[9px] tracking-[0.04em] text-ink/50">
					L{a.level} · {levelLabels[a.level]}
				</span>
			</div>
		</div>
	);
}

export default async function AgentsPage({ params }: PageProps) {
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
			/>

			{c.groups.map((g) => (
				<div key={g.num}>
					<SectionHeader
						num={g.num}
						eyebrow={g.eyebrow}
						title={
							<>
								{g.title} <em className="grad-text">{g.titleItalic}</em>
							</>
						}
						subtitle={g.sub}
					/>
					<div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 px-8 pb-7 md:grid-cols-2 lg:grid-cols-3">
						{g.agents.map((a) => (
							<AgentCard key={a.tag} a={a} levelLabels={c.levelLabels} />
						))}
					</div>
				</div>
			))}

			<SectionHeader
				eyebrow={c.ladderEyebrow}
				title={
					<>
						{c.ladderTitleBefore}
						<em className="grad-text">{c.ladderTitleEm}</em>
					</>
				}
				subtitle={c.ladderSubtitle}
			/>
			<div className="mx-auto grid max-w-3xl grid-cols-2 gap-3.5 px-8 pb-12 md:grid-cols-4">
				{([1, 2, 3, 4] as AgentLevel[]).map((l) => (
					<div key={l} className="glass p-4">
						<div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.06em] text-ink/40">
							<span>L{l}</span>
							<AutonomyPips level={l} />
						</div>
						<div className="mb-0.5 text-[13px] font-medium">{c.levelLabels[l]}</div>
						<div className="text-[11.5px] leading-[1.45] text-ink/55">{c.ladderDesc[l]}</div>
					</div>
				))}
			</div>
		</>
	);
}
