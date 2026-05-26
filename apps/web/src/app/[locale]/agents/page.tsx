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

const levelLabels: Record<AgentLevel, string> = {
  1: "Advisor",
  2: "Co-pilot",
  3: "Auto-pilot",
  4: "Autonomous",
};

const groups: { num: string; eyebrow: string; title: string; titleItalic: string; sub?: string; agents: Agent[] }[] = [
  {
    num: "01",
    eyebrow: "Crop Lifecycle",
    title: "Agents that",
    titleItalic: "grow the crop.",
    sub: "From planning rotations to feeding the soil, these four oversee the biological side of the farm.",
    agents: [
      { icon: "📋", name: "Planning",    tag: "PLN · The strategist",  desc: "Recommends crop rotation, varieties, ROI scenarios for the season ahead.",   level: 2 },
      { icon: "🌱", name: "Seeding",     tag: "SED · The sower",       desc: "Optimal sowing dates from soil temperature, weather, lunar phase. Issues work orders.", level: 2 },
      { icon: "💧", name: "Irrigation",  tag: "IRR · The hydrologist", desc: "Real-time moisture monitoring, auto-controls drip systems, integrates ET models.",       level: 4 },
      { icon: "🧪", name: "Nutrition",   tag: "NUT · The agrochemist", desc: "Reads soil samples + NDVI, recommends variable-rate fertilizer. Exports prescription maps.", level: 2 },
    ],
  },
  {
    num: "02",
    eyebrow: "Monitoring & Detection",
    title: "Agents that",
    titleItalic: "watch the field.",
    sub: "Satellite eyes, plant-level computer vision, hyper-local weather — they spot problems before you do.",
    agents: [
      { icon: "🛰️", name: "Satellite",       tag: "SAT · Eye from space",   desc: "Pulls Sentinel-2/Landsat, processes NDVI/NDWI/NDRE, weekly anomaly reports.",  level: 4 },
      { icon: "🦠", name: "Disease",          tag: "DIS · Phytopathologist", desc: "CV on drone/phone photos. Identifies diseases & pests with probability scores.", level: 2 },
      { icon: "🌾", name: "Weed scout",       tag: "WDS · Weed botanist",     desc: "Per-plant segmentation, generates spot-spray maps. Cuts herbicide by 60-90%.",   level: 3 },
      { icon: "🌦️", name: "Weather sentry",   tag: "WTR · Meteorologist",    desc: "Hyper-local forecasts, preventive alerts: hail, frost, storms — with action steps.", level: 4 },
    ],
  },
  {
    num: "03",
    eyebrow: "Operations",
    title: "Agents that",
    titleItalic: "run the work.",
    agents: [
      { icon: "🚜", name: "Fleet",     tag: "FLT · The dispatcher",  desc: "Routes tractors, combines, tankers. Predictive maintenance from telemetry.", level: 3 },
      { icon: "👥", name: "Labor",     tag: "LAB · HR coordinator",  desc: "Assigns workers by urgency, skill, location. Tracks tasks via mobile.",      level: 2 },
      { icon: "📦", name: "Inventory", tag: "INV · Storekeeper",     desc: "Tracks seeds, fertilizer, fuel, chemicals. Auto-orders at reorder point.",   level: 3 },
    ],
  },
  {
    num: "04",
    eyebrow: "Business & Compliance",
    title: "Agents that",
    titleItalic: "protect the margin.",
    agents: [
      { icon: "📈", name: "Market",     tag: "MKT · The trader",      desc: "CBOT, MATIF, local prices. Forecasts 7/30/90d. Recommends sell & hedge windows.", level: 2 },
      { icon: "📰", name: "News",       tag: "NWS · The journalist",   desc: "Reads 200+ sources nightly. Flags what affects your crop in plain language.",   level: 4 },
      { icon: "🛡️", name: "Compliance", tag: "CMP · The lawyer",       desc: "Auto-fills CAP subsidy forms, audit trails, GAP / GlobalGAP cert prep.",         level: 1 },
      { icon: "🌍", name: "Carbon",     tag: "CO2 · The ESG officer",  desc: "Per-operation carbon footprint. Optimizes for credits. Generates MRV reports.",  level: 2 },
      { icon: "💰", name: "Finance",    tag: "FIN · The CFO",          desc: "Real-time P&L per field, cash flow forecasts, accountant-ready exports.",       level: 1 },
    ],
  },
  {
    num: "05",
    eyebrow: "Meta Layer",
    title: "Agents that",
    titleItalic: "think about thinking.",
    agents: [
      { icon: "⚙️", name: "Orchestrator", tag: "ORC · The chief",            desc: "Coordinates the mesh, resolves conflicts, escalates only critical decisions to you.", level: 4 },
      { icon: "💬", name: "Conversation",  tag: "CNV · Personal assistant",  desc: "Your voice / chat entry point. Routes & aggregates.",                                level: 4 },
      { icon: "🎓", name: "Learning",      tag: "LRN · The scientist",       desc: "Studies what worked. Updates models. Federated learning across farms (anonymized).", level: 4 },
    ],
  },
];

function AutonomyPips({ level }: { level: AgentLevel }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={
            i <= level
              ? "w-1.5 h-1.5 rounded-full bg-brand-gradient"
              : "w-1.5 h-1.5 rounded-full bg-ink/10"
          }
        />
      ))}
    </div>
  );
}

function AgentCard({ a }: { a: Agent }) {
  return (
    <div className="glass p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(31,77,44,0.18)]">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-forest-700/[0.12] to-harvest-500/[0.12] flex items-center justify-center text-base flex-shrink-0">
          {a.icon}
        </div>
        <div>
          <div className="text-[13px] font-medium leading-[1.1]">{a.name}</div>
          <div className="font-mono text-[9px] text-ink/40 tracking-[0.06em]">{a.tag}</div>
        </div>
      </div>
      <div className="text-[11.5px] text-ink/60 leading-[1.45] mb-2.5 min-h-[36px]">{a.desc}</div>
      <div className="flex items-center justify-between pt-2.5 border-t border-ink/[0.06]">
        <AutonomyPips level={a.level} />
        <span className="font-mono text-[9px] text-ink/50 tracking-[0.04em]">L{a.level} · {levelLabels[a.level]}</span>
      </div>
    </div>
  );
}

export default async function AgentsPage({ params }: PageProps) {
	setRequestLocale((await params).locale);
	return (
    <>
      <Hero
        eyebrow="// The agent mesh"
        title={
          <>
            Eighteen specialists.
            <br />
            One <em className="grad-text not-italic [font-style:italic]">thinking farm.</em>
          </>
        }
        subtitle="AgriNexus isn't one AI — it's a coordinated team of 18. Each owns a domain. Each acts within bounds you set. Together, they run a farm that almost runs itself."
      />

      {groups.map((g) => (
        <div key={g.num}>
          <SectionHeader num={g.num} eyebrow={g.eyebrow}
            title={<>{g.title} <em className="grad-text">{g.titleItalic}</em></>}
            subtitle={g.sub}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-8 pb-7 max-w-3xl mx-auto">
            {g.agents.map((a) => <AgentCard key={a.tag} a={a} />)}
          </div>
        </div>
      ))}

      <SectionHeader
        eyebrow="// Autonomy ladder"
        title={<>You set how much <em className="grad-text">they decide.</em></>}
        subtitle="Each agent can operate at one of four levels. You raise the level as trust builds. Drop it anytime."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 px-8 pb-12 max-w-3xl mx-auto">
        {([1, 2, 3, 4] as AgentLevel[]).map((l) => (
          <div key={l} className="glass p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] text-ink/40 tracking-[0.06em] mb-2">
              <span>L{l}</span>
              <AutonomyPips level={l} />
            </div>
            <div className="text-[13px] font-medium mb-0.5">{levelLabels[l]}</div>
            <div className="text-[11.5px] text-ink/55 leading-[1.45]">
              {l === 1 && "Recommends only. You decide and execute."}
              {l === 2 && "Executes after a single tap of confirmation."}
              {l === 3 && "Acts within bounds you set. Reports after."}
              {l === 4 && "Full ownership of its domain. Kill switch always on."}
            </div>
          </div>
        ))}
      </div>

    </>
  );
}
