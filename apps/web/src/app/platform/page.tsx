import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Platform — sense, think, act",
  description:
    "Three layers, one nervous system. Satellites feed the brain, the brain commands the hands. Every signal traceable, every action reversible.",
};

const layers = [
  {
    num: "01",
    tag: "SENSE",
    title: "Eyes everywhere,",
    titleItalic: "always on.",
    sub: "Hourly sentinel imagery, real-time sensors in the soil, weather radars overhead, news scrapers worldwide. The platform inhales data so the farmer doesn't have to.",
    cards: [
      { icon: "🛰️", name: "Satellite stack", desc: "Sentinel-2, Landsat, Planet Labs. NDVI, NDWI, NDRE, thermal. Auto-processed weekly.", specs: ["10m/px", "5-day cadence"] },
      { icon: "📡", name: "IoT mesh",         desc: "Soil moisture, EC, pH, leaf wetness, weather stations. LoRaWAN & cellular.",        specs: ["MQTT", "Edge buffered"] },
      { icon: "📰", name: "Market & news",    desc: "CBOT, MATIF, USDA. 200+ news sources. NLP-classified by relevance to your crop.",  specs: ["6×/h", "12 languages"] },
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
      { icon: "🕸️", name: "Agent mesh",         desc: "18 specialist agents coordinated by an orchestrator. Each has tools, memory, autonomy levels.", specs: ["LangGraph", "MCP tools"] },
      { icon: "⚙️", name: "Model library",      desc: "Claude for reasoning, YOLO for vision, XGBoost for forecasting, fine-tuned LLMs per region.", specs: ["Ensemble", "Federated"] },
    ],
  },
  {
    num: "03",
    tag: "ACT",
    title: "Words, then",
    titleItalic: "actions.",
    sub: "Decisions reach you through whatever feels natural — a morning briefing, a voice note, a tap on the phone. Or they reach the pump, the tractor, the buyer's contract — directly, within bounds you set.",
    cards: [
      { icon: "📩", name: "Daily Briefing",      desc: "Three things at 06:42 every morning. Push, email, voice. Speak any of 12 languages.",       specs: ["06:42 local", "Voice ready"] },
      { icon: "▶",  name: "Autonomous actions", desc: "Pumps, valves, machinery. Forward contracts. Inventory orders. All gated by your rules.",  specs: ["L1 to L4", "Audit log"] },
      { icon: "📱", name: "Mobile & web",        desc: "Native iOS, Android, web. Offline mode for field. WhatsApp & Telegram fallback.",         specs: ["Offline-first", "PWA"] },
    ],
  },
];

const integrations = [
  { label: "Machinery",    items: ["John Deere Ops", "Trimble Ag", "Claas Telematics", "Case IH AFS", "Kubota Now"] },
  { label: "Data sources", items: ["Sentinel Hub", "Planet Labs", "USDA APIs", "FAO datasets", "Open-Meteo"] },
  { label: "Finance",      items: ["Rabobank", "UniCredit Agri", "StoneX", "Crop insurance APIs", "Stripe payouts"] },
  { label: "Workflow",     items: ["WhatsApp Business", "Telegram", "Slack", "Google Calendar", "SAP Agri"] },
];

const trust = [
  { icon: "🛡️", name: "Data sovereignty",   desc: "Your farm data is yours. We process it on your behalf. We never sell, share, or train commercial models on it.",    badge: "GDPR · EU residency" },
  { icon: "🔒", name: "Auditable decisions", desc: "Every agent action carries its reasoning trace. Every change reversible. Compliance teams can replay any decision.", badge: "SOC 2 · ISO 27001" },
  { icon: "⌨", name: "Developer access",    desc: "REST + GraphQL APIs. Webhooks. MCP tool spec for agent builders. Open SDK in Python, JS, Go.",                       badge: "developers.agrinexus.io" },
];

export default function PlatformPage() {
  return (
    <>
      <Hero
        eyebrow="// Platform"
        title={
          <>
            An operating system
            <br />
            that <em className="grad-text not-italic [font-style:italic]">senses, thinks, acts.</em>
          </>
        }
        subtitle="Three layers, one nervous system. Sensors feed the brain, the brain commands the hands. Every signal traceable, every action reversible."
      />

      {layers.map((layer) => (
        <section key={layer.num} className="py-8 px-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-3.5 mb-3.5">
            <span className="font-serif text-4xl leading-none text-ink/20 tracking-[-0.02em]">{layer.num}</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-ink/50 uppercase py-1 px-2.5 rounded bg-forest-700/[0.06] border border-forest-700/[0.15]">
              {layer.tag}
            </span>
          </div>
          <h2 className="font-serif text-3xl font-normal tracking-[-0.02em] mb-2 leading-[1.15]">
            {layer.title} <em className="grad-text">{layer.titleItalic}</em>
          </h2>
          <p className="text-sm text-ink/60 leading-[1.55] max-w-xl mb-5">{layer.sub}</p>
          <div className="grid md:grid-cols-3 gap-3">
            {layer.cards.map((c) => (
              <div key={c.name} className="glass p-5">
                <div className="w-9 h-9 bg-gradient-to-br from-forest-700/10 to-harvest-500/[0.12] rounded-full flex items-center justify-center mb-3.5 text-lg">
                  {c.icon}
                </div>
                <div className="text-sm font-medium mb-1">{c.name}</div>
                <div className="text-[12.5px] text-ink/60 leading-[1.5] mb-3">{c.desc}</div>
                <div className="flex gap-1.5 flex-wrap pt-2.5 border-t border-ink/[0.06]">
                  {c.specs.map((s) => (
                    <span key={s} className="font-mono text-[10px] py-0.5 px-2 bg-ink/[0.04] text-ink/60 rounded tracking-[0.04em]">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <SectionHeader
        eyebrow="// Integrations"
        title={<>Plays well with <em className="grad-text">what you already use.</em></>}
        subtitle="Open standards, real APIs. Drop AgriNexus on top of your existing stack — or use it standalone."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-8 pb-12 max-w-3xl mx-auto">
        {integrations.map((cat) => (
          <div key={cat.label} className="glass p-4">
            <div className="font-mono text-[10px] text-ink/50 tracking-[0.06em] uppercase mb-2.5 pb-2 border-b border-ink/[0.06]">
              {cat.label}
            </div>
            <div className="flex flex-col gap-1.5 text-[11.5px] text-ink/70 leading-[1.4]">
              {cat.items.map((i) => <span key={i}>{i}</span>)}
            </div>
          </div>
        ))}
      </div>

      <SectionHeader
        num="04"
        eyebrow="Foundation"
        title={<>Built on <em className="grad-text">boring fundamentals.</em></>}
        subtitle="Security, privacy, openness — not features, but precondition."
      />
      <div className="grid md:grid-cols-3 gap-3 px-8 pb-12 max-w-3xl mx-auto">
        {trust.map((t) => (
          <div key={t.name} className="glass p-5">
            <div className="text-2xl mb-3">{t.icon}</div>
            <div className="text-[13.5px] font-medium mb-1">{t.name}</div>
            <div className="text-xs text-ink/60 leading-[1.5] mb-2.5">{t.desc}</div>
            <span className="inline-block py-0.5 px-2 font-mono text-[9px] text-forest-700 bg-forest-700/[0.06] border border-forest-700/[0.15] rounded tracking-[0.06em]">
              {t.badge}
            </span>
          </div>
        ))}
      </div>

    </>
  );
}
