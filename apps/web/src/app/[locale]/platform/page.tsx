import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Платформа — усеща, мисли, действа",
				description:
					"Три слоя, една нервна система. Сензорите подават сигнали към мозъка, а мозъкът управлява действията. Всеки сигнал е проследим, всяко действие е обратимо.",
			}
		: {
				title: "Platform — sense, think, act",
				description:
					"Three layers, one nervous system. Satellites feed the brain, the brain commands the hands. Every signal traceable, every action reversible.",
			};
}

const copy = {
	en: {
		heroEyebrow: "// Platform",
		heroBefore: "An operating system",
		heroAfter: "that ",
		heroEm: "senses, thinks, acts.",
		heroSubtitle:
			"Three layers, one nervous system. Sensors feed the brain, the brain commands the hands. Every signal traceable, every action reversible.",
		integrations: {
			eyebrow: "// Integrations",
			titleBefore: "Plays well with ",
			titleEm: "what you already use.",
			subtitle: "Open standards, real APIs. Drop AgriNexus on top of your existing stack — or use it standalone.",
		},
		trust: {
			eyebrow: "Foundation",
			titleBefore: "Built on ",
			titleEm: "boring fundamentals.",
			subtitle: "Security, privacy, openness — not features, but precondition.",
		},
		layers: [
			{
				num: "01",
				tag: "SENSE",
				title: "Eyes everywhere,",
				titleItalic: "always on.",
				sub: "Hourly sentinel imagery, real-time sensors in the soil, weather radars overhead, news scrapers worldwide. The platform inhales data so the farmer doesn't have to.",
				cards: [
					{ icon: "🛰️", name: "Satellite stack", desc: "Sentinel-2, Landsat, Planet Labs. NDVI, NDWI, NDRE, thermal. Auto-processed weekly.", specs: ["10m/px", "5-day cadence"] },
					{ icon: "📡", name: "IoT mesh", desc: "Soil moisture, EC, pH, leaf wetness, weather stations. LoRaWAN & cellular.", specs: ["MQTT", "Edge buffered"] },
					{ icon: "📰", name: "Market & news", desc: "CBOT, MATIF, USDA. 200+ news sources. NLP-classified by relevance to your crop.", specs: ["6x/h", "12 languages"] },
				],
			},
			{
				num: "02",
				tag: "THINK",
				title: "The mesh that",
				titleItalic: "makes sense of it.",
				sub: "A data lake stores everything. A model library feeds the 18 agents. The orchestrator routes decisions and resolves their conflicts.",
				cards: [
					{ icon: "💾", name: "Unified data lake", desc: "Time-series, geospatial, vector, document. Every observation timestamped & traceable.", specs: ["PostGIS", "TimescaleDB", "Pinecone"] },
					{ icon: "🕸️", name: "Agent mesh", desc: "18 specialist agents coordinated by an orchestrator. Each has tools, memory, autonomy levels.", specs: ["LangGraph", "MCP tools"] },
					{ icon: "⚙️", name: "Model library", desc: "Claude for reasoning, YOLO for vision, XGBoost for forecasting, fine-tuned LLMs per region.", specs: ["Ensemble", "Federated"] },
				],
			},
			{
				num: "03",
				tag: "ACT",
				title: "Words, then",
				titleItalic: "actions.",
				sub: "Decisions reach you through whatever feels natural — a morning briefing, a voice note, a tap on the phone. Or they reach the pump, the tractor, the buyer's contract — directly, within bounds you set.",
				cards: [
					{ icon: "📩", name: "Daily Briefing", desc: "Three things at 06:42 every morning. Push, email, voice. Speak any of 12 languages.", specs: ["06:42 local", "Voice ready"] },
					{ icon: "▶", name: "Autonomous actions", desc: "Pumps, valves, machinery. Forward contracts. Inventory orders. All gated by your rules.", specs: ["L1 to L4", "Audit log"] },
					{ icon: "📱", name: "Mobile & web", desc: "Native iOS, Android, web. Offline mode for field. WhatsApp & Telegram fallback.", specs: ["Offline-first", "PWA"] },
				],
			},
		],
		integrationGroups: [
			{ label: "Machinery", items: ["John Deere Ops", "Trimble Ag", "Claas Telematics", "Case IH AFS", "Kubota Now"] },
			{ label: "Data sources", items: ["Sentinel Hub", "Planet Labs", "USDA APIs", "FAO datasets", "Open-Meteo"] },
			{ label: "Finance", items: ["Rabobank", "UniCredit Agri", "StoneX", "Crop insurance APIs", "Stripe payouts"] },
			{ label: "Workflow", items: ["WhatsApp Business", "Telegram", "Slack", "Google Calendar", "SAP Agri"] },
		],
		trustCards: [
			{ icon: "🛡️", name: "Data sovereignty", desc: "Your farm data is yours. We process it on your behalf. We never sell, share, or train commercial models on it.", badge: "GDPR · EU residency" },
			{ icon: "🔒", name: "Auditable decisions", desc: "Every agent action carries its reasoning trace. Every change reversible. Compliance teams can replay any decision.", badge: "SOC 2 · ISO 27001" },
			{ icon: "⌨", name: "Developer access", desc: "REST + GraphQL APIs. Webhooks. MCP tool spec for agent builders. Open SDK in Python, JS, Go.", badge: "developers.agrinexus.io" },
		],
	},
	bg: {
		heroEyebrow: "// Платформа",
		heroBefore: "Операционна система",
		heroAfter: "която ",
		heroEm: "усеща, мисли, действа.",
		heroSubtitle:
			"Три слоя, една нервна система. Сензорите подават сигнали към мозъка, а мозъкът управлява действията. Всеки сигнал е проследим, всяко действие е обратимо.",
		integrations: {
			eyebrow: "// Интеграции",
			titleBefore: "Работи с ",
			titleEm: "това, което вече използваш.",
			subtitle: "Отворени стандарти и реални API. AgriNexus може да легне върху текущия ти стек или да работи самостоятелно.",
		},
		trust: {
			eyebrow: "Основа",
			titleBefore: "Изградено върху ",
			titleEm: "стабилни основи.",
			subtitle: "Сигурност, поверителност и отвореност — не като екстри, а като предварително условие.",
		},
		layers: [
			{
				num: "01",
				tag: "УСЕЩА",
				title: "Очи навсякъде,",
				titleItalic: "винаги включени.",
				sub: "Сателитни изображения, почвени сензори, метео радари и новинарски източници. Платформата събира сигналите, за да не се налага фермерът да го прави ръчно.",
				cards: [
					{ icon: "🛰️", name: "Сателитен слой", desc: "Sentinel-2, Landsat, Planet Labs. NDVI, NDWI, NDRE и термални данни, обработвани автоматично.", specs: ["10 м/пиксел", "на 5 дни"] },
					{ icon: "📡", name: "IoT мрежа", desc: "Влага, EC, pH, листна влага и метеостанции през LoRaWAN и клетъчна връзка.", specs: ["MQTT", "edge буфер"] },
					{ icon: "📰", name: "Пазар и новини", desc: "CBOT, MATIF, USDA и 200+ източника, класифицирани по значение за културата.", specs: ["6x/ч", "12 езика"] },
				],
			},
			{
				num: "02",
				tag: "МИСЛИ",
				title: "Мрежа, която",
				titleItalic: "прави смисъл от данните.",
				sub: "Единно езеро от данни пази всичко. Библиотека от модели захранва 18 агента, а оркестраторът маршрутизира решенията и решава конфликтите.",
				cards: [
					{ icon: "💾", name: "Единно езеро от данни", desc: "Времеви серии, геоданни, вектори и документи. Всяко наблюдение е с време и следа.", specs: ["PostGIS", "TimescaleDB", "Pinecone"] },
					{ icon: "🕸️", name: "Мрежа от агенти", desc: "18 специализирани агента, координирани от оркестратор, с инструменти, памет и нива на автономност.", specs: ["LangGraph", "MCP tools"] },
					{ icon: "⚙️", name: "Библиотека от модели", desc: "Модели за reasoning, vision, прогнози и локално адаптирани LLM-и по регион.", specs: ["ансамбъл", "federated"] },
				],
			},
			{
				num: "03",
				tag: "ДЕЙСТВА",
				title: "Първо думи, после",
				titleItalic: "действия.",
				sub: "Решенията стигат до теб като сутрешен briefing, гласова бележка или докосване на телефона. Или стигат до помпата, трактора и договора — директно, в граници, зададени от теб.",
				cards: [
					{ icon: "📩", name: "Дневен briefing", desc: "Три важни неща всяка сутрин в 06:42. Push, имейл или глас на 12 езика.", specs: ["06:42 локално", "готово за глас"] },
					{ icon: "▶", name: "Автономни действия", desc: "Помпи, клапани, машини, договори и складови заявки — винаги през твоите правила.", specs: ["L1 до L4", "одит лог"] },
					{ icon: "📱", name: "Мобилно и web", desc: "iOS, Android и web. Офлайн режим за полето, WhatsApp и Telegram като резервен канал.", specs: ["offline-first", "PWA"] },
				],
			},
		],
		integrationGroups: [
			{ label: "Машини", items: ["John Deere Ops", "Trimble Ag", "Claas Telematics", "Case IH AFS", "Kubota Now"] },
			{ label: "Източници на данни", items: ["Sentinel Hub", "Planet Labs", "USDA APIs", "FAO datasets", "Open-Meteo"] },
			{ label: "Финанси", items: ["Rabobank", "UniCredit Agri", "StoneX", "API за застраховки", "Stripe payouts"] },
			{ label: "Работен поток", items: ["WhatsApp Business", "Telegram", "Slack", "Google Calendar", "SAP Agri"] },
		],
		trustCards: [
			{ icon: "🛡️", name: "Суверенитет на данните", desc: "Данните от стопанството са твои. Обработваме ги от твое име и не ги продаваме, споделяме или ползваме за обучение на търговски модели.", badge: "GDPR · EU residency" },
			{ icon: "🔒", name: "Проследими решения", desc: "Всяко действие на агент има следа на reasoning. Всяка промяна е обратима и може да бъде прегледана.", badge: "SOC 2 · ISO 27001" },
			{ icon: "⌨", name: "Достъп за разработчици", desc: "REST и GraphQL API, webhooks, MCP спецификация и отворени SDK за Python, JS и Go.", badge: "developers.agrinexus.io" },
		],
	},
};

export default async function PlatformPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<>
			<Hero
				eyebrow={c.heroEyebrow}
				title={
					<>
						{c.heroBefore}
						<br />
						{c.heroAfter}
						<em className="grad-text not-italic [font-style:italic]">{c.heroEm}</em>
					</>
				}
				subtitle={c.heroSubtitle}
			/>

			{c.layers.map((layer) => (
				<section key={layer.num} className="mx-auto max-w-3xl px-8 py-8">
					<div className="mb-3.5 flex items-center gap-3.5">
						<span className="font-serif text-4xl leading-none tracking-[-0.02em] text-ink/20">{layer.num}</span>
						<span className="rounded border border-forest-700/[0.15] bg-forest-700/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/50">
							{layer.tag}
						</span>
					</div>
					<h2 className="mb-2 font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em]">
						{layer.title} <em className="grad-text">{layer.titleItalic}</em>
					</h2>
					<p className="mb-5 max-w-xl text-sm leading-[1.55] text-ink/60">{layer.sub}</p>
					<div className="grid gap-3 md:grid-cols-3">
						{layer.cards.map((card) => (
							<div key={card.name} className="glass p-5">
								<div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-forest-700/10 to-harvest-500/[0.12] text-lg">
									{card.icon}
								</div>
								<div className="mb-1 text-sm font-medium">{card.name}</div>
								<div className="mb-3 text-[12.5px] leading-[1.5] text-ink/60">{card.desc}</div>
								<div className="flex flex-wrap gap-1.5 border-t border-ink/[0.06] pt-2.5">
									{card.specs.map((s) => (
										<span key={s} className="rounded bg-ink/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-ink/60">
											{s}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				</section>
			))}

			<SectionHeader
				eyebrow={c.integrations.eyebrow}
				title={
					<>
						{c.integrations.titleBefore}
						<em className="grad-text">{c.integrations.titleEm}</em>
					</>
				}
				subtitle={c.integrations.subtitle}
			/>
			<div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 px-8 pb-12 md:grid-cols-4">
				{c.integrationGroups.map((cat) => (
					<div key={cat.label} className="glass p-4">
						<div className="mb-2.5 border-b border-ink/[0.06] pb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/50">{cat.label}</div>
						<div className="flex flex-col gap-1.5 text-[11.5px] leading-[1.4] text-ink/70">
							{cat.items.map((item) => (
								<span key={item}>{item}</span>
							))}
						</div>
					</div>
				))}
			</div>

			<SectionHeader
				num="04"
				eyebrow={c.trust.eyebrow}
				title={
					<>
						{c.trust.titleBefore}
						<em className="grad-text">{c.trust.titleEm}</em>
					</>
				}
				subtitle={c.trust.subtitle}
			/>
			<div className="mx-auto grid max-w-3xl gap-3 px-8 pb-12 md:grid-cols-3">
				{c.trustCards.map((item) => (
					<div key={item.name} className="glass p-5">
						<div className="mb-3 text-2xl">{item.icon}</div>
						<div className="mb-1 text-[13.5px] font-medium">{item.name}</div>
						<div className="mb-2.5 text-xs leading-[1.5] text-ink/60">{item.desc}</div>
						<span className="inline-block rounded border border-forest-700/[0.15] bg-forest-700/[0.06] px-2 py-0.5 font-mono text-[9px] tracking-[0.06em] text-forest-700">
							{item.badge}
						</span>
					</div>
				))}
			</div>
		</>
	);
}
