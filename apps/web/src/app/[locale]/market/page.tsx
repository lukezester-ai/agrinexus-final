import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { CTA, CTARow } from "@/components/CTA";

export const metadata: Metadata = {
  title: "Market intelligence — trade like a hedge fund, farm like a craftsman",
  description:
    "Real-time prices, 90-day forecasts, signal explanations. The same data the agribusiness desks use — free for every grower.",
};

const tickers = [
  { sym: "WHEAT", name: "EU milling · DEC26",   price: "€246.50", delta: "+€8.00 +2.4%", up: true,  spark: [6,9,7,11,14,12,16,18] },
  { sym: "CORN",  name: "CBOT · MAR27",          price: "$4.82",   delta: "−$0.06 −1.2%", up: false, spark: [14,12,13,10,11,9,8,7] },
  { sym: "SUN",   name: "Black Sea oil · spot",  price: "$1,034",  delta: "+$22 +2.2%",   up: true,  spark: [8,10,9,12,11,14,15,17] },
  { sym: "RAPE",  name: "MATIF rapeseed · NOV26", price: "€468",   delta: "+€4 +0.9%",    up: true,  spark: [10,11,10,12,11,13,12,14] },
  { sym: "SOY",   name: "CBOT · JAN27",          price: "$10.84",  delta: "−$0.12 −1.1%", up: false, spark: [13,14,12,13,11,10,9,8] },
  { sym: "BARL",  name: "EU feed · spot",        price: "€198",    delta: "+€3 +1.5%",    up: true,  spark: [8,9,10,9,11,10,12,13] },
];

const signals = [
  { dir: "up",   text: "Russia extended grain export quotas",        sub: "[NWS] 12 sources · published 03:14 EET · correlation 0.74", impact: "+0.9%" },
  { dir: "up",   text: "US Plains drought index +12 points",          sub: "[WTR] NOAA + Sentinel-2 · correlation 0.68",                impact: "+0.7%" },
  { dir: "up",   text: "EUR weaker vs USD by 1.2% overnight",         sub: "[FIN] ECB rate decision priced in · correlation 0.55",     impact: "+0.5%" },
  { dir: "flat", text: "USDA WASDE report tomorrow",                  sub: "[NWS] historical: 60% of moves happen post-release",       impact: "±0.0%" },
  { dir: "down", text: "Argentine harvest 3% above forecast",         sub: "[SAT] Planet Labs imagery · correlation 0.62",              impact: "−0.3%" },
];

const months = [
  { mo: "Jun", price: "€246", opacity: 0.5,  color: "#c4a86a" },
  { mo: "Jul", price: "€254", opacity: 0.7,  color: "#c4a86a" },
  { mo: "Aug", price: "€261", opacity: 0.6,  color: "#5a9968" },
  { mo: "Sep", price: "€268", opacity: 0.85, color: "#5a9968" },
  { mo: "Oct", price: "€272", opacity: 0.9,  color: "#1f4d2c" },
  { mo: "Nov", price: "€270", opacity: 0.95, color: "#1f4d2c" },
  { mo: "Dec", price: "€264", opacity: 0.75, color: "#5a9968" },
  { mo: "Jan", price: "€255", opacity: 0.5,  color: "#5a9968" },
  { mo: "Feb", price: "€243", opacity: 0.55, color: "#b87a3d" },
  { mo: "Mar", price: "€238", opacity: 0.7,  color: "#b87a3d" },
  { mo: "Apr", price: "€241", opacity: 0.5,  color: "#c4a86a" },
  { mo: "May", price: "€247", opacity: 0.6,  color: "#c4a86a" },
];

export default function MarketPage() {
  return (
    <>
      <Hero
        eyebrow="// Market intelligence"
        title={
          <>
            Trade like a hedge fund.
            <br />
            <em className="grad-text not-italic [font-style:italic]">Farm like a craftsman.</em>
          </>
        }
        subtitle="Real-time prices, 90-day forecasts, signal explanations. The same data the agribusiness desks use — translated for the farm, free for every grower."
      />

      {/* Bloomberg-style terminal */}
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="bg-[rgba(14,40,24,0.92)] rounded-[18px] p-1 shadow-[0_30px_60px_-20px_rgba(14,40,24,0.4),0_12px_24px_-12px_rgba(31,77,44,0.2)]">
          <div className="bg-[#0a1a10] rounded-[15px] overflow-hidden text-forest-200 font-mono">

            <div className="flex items-center justify-between py-3 px-4 border-b border-forest-200/10 text-[10px]">
              <div className="flex gap-3.5">
                <span className="text-harvest-200">AGRX</span>
                <span>Commodity desk</span>
                <span className="text-forest-200/50">14:23 EET</span>
              </div>
              <div className="text-forest-200/50 flex gap-3.5 items-center">
                <span className="inline-flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-forest-500 before:animate-pulse">LIVE</span>
                <span>MATIF · CBOT · KCBT</span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-1.5">
              {tickers.map((t) => (
                <div key={t.sym} className="grid grid-cols-[70px_1fr_90px_90px_80px] gap-3.5 py-1.5 text-xs border-b border-forest-200/[0.04] last:border-b-0 items-center">
                  <span className="text-harvest-200 font-medium tracking-[0.04em]">{t.sym}</span>
                  <span className="text-forest-200/70 text-[11px]">{t.name}</span>
                  <span className="text-[#f8f6f1] tabular-nums font-medium">{t.price}</span>
                  <span className={`tabular-nums text-[11px] ${t.up ? "text-forest-500" : "text-[#e09595]"}`}>{t.delta}</span>
                  <span className="hidden sm:flex items-end gap-px h-5">
                    {t.spark.map((h, i) => (
                      <span key={i} className="w-[3px] bg-harvest-500/60 rounded-sm" style={{ height: `${h}px` }} />
                    ))}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Forecast */}
      <SectionHeader
        num="01"
        eyebrow="90-day forecast"
        title={<>Where wheat <em className="grad-text">is going.</em></>}
        subtitle="Ensemble of weather, demand, currency and supply models. Confidence interval shown so you know how much weight to give it."
      />
      <div className="px-6 pb-8 max-w-3xl mx-auto">
        <div className="glass p-6">
          <div className="flex justify-between items-baseline mb-4 pb-3.5 border-b border-ink/[0.06]">
            <div className="font-serif text-xl font-normal tracking-[-0.015em]">Wheat · DEC26 forecast</div>
            <div className="font-mono text-[11px] text-ink/50">Confidence: 78% · updated 06:42</div>
          </div>

          <div className="h-[220px] mb-4">
            <svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="m-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#5a9968" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#5a9968" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="m-conf" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#c4a86a" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="#c4a86a" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              <g opacity="0.3">
                <line x1="0" y1="50" x2="700" y2="50" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4"/>
                <line x1="0" y1="100" x2="700" y2="100" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4"/>
                <line x1="0" y1="150" x2="700" y2="150" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,4"/>
              </g>
              <text x="4" y="48"  fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€280</text>
              <text x="4" y="98"  fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€250</text>
              <text x="4" y="148" fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">€220</text>

              <path d="M 320 70 Q 400 60 460 75 T 560 65 T 660 70 L 660 130 Q 560 125 460 130 T 320 130 Z" fill="url(#m-conf)"/>
              <path d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95 L 320 170 L 0 170 Z" fill="url(#m-area)"/>
              <path d="M 0 140 L 30 138 L 60 142 L 90 130 L 120 132 L 150 125 L 180 120 L 210 128 L 240 115 L 270 108 L 300 100 L 320 95" stroke="#1f4d2c" strokeWidth="2" fill="none"/>
              <path d="M 320 95 Q 400 80 460 85 T 560 78 T 660 80" stroke="#c4a86a" strokeWidth="2" fill="none" strokeDasharray="4,3"/>
              <line x1="320" y1="0" x2="320" y2="180" stroke="#0a0a0a" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4"/>
              <circle cx="320" cy="95" r="4" fill="#1f4d2c"/>
              <circle cx="560" cy="78" r="4" fill="#c4a86a"/>
              <text x="290" y="200" fontSize="10" fill="#0a0a0a" fontWeight="500">Today · €246</text>
              <text x="540" y="65" fontSize="10" fill="#8a6a2f" fontWeight="500">Sep 30 · €268</text>

              <rect x="440" y="0" width="120" height="180" fill="rgba(45,122,63,0.08)" stroke="none"/>
              <text x="445" y="14" fontSize="9" fill="#2d7a3f" fontFamily="ui-monospace,monospace" fontWeight="600">OPTIMAL WINDOW</text>

              <g fontSize="9" fill="rgba(10,10,10,0.5)" fontFamily="ui-monospace,monospace">
                <text x="0"   y="215">Jun</text>
                <text x="80"  y="215">Jul</text>
                <text x="160" y="215">Aug</text>
                <text x="240" y="215">Sep</text>
                <text x="380" y="215">Oct</text>
                <text x="460" y="215">Nov</text>
                <text x="540" y="215">Dec</text>
                <text x="620" y="215">Jan</text>
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5 border-t border-ink/[0.06]">
            <div className="py-2.5">
              <div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">Now</div>
              <div className="font-serif text-[22px] text-forest-700 tracking-[-0.01em]">€246</div>
              <div className="text-[10px] text-ink/50 mt-0.5">EU milling, DEC26</div>
            </div>
            <div className="py-2.5">
              <div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">Forecast Sep 30</div>
              <div className="font-serif text-[22px] text-harvest-700 tracking-[-0.01em]">€268 ±€14</div>
              <div className="text-[10px] text-ink/50 mt-0.5">78% confidence</div>
            </div>
            <div className="py-2.5">
              <div className="font-mono text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-1">Over break-even</div>
              <div className="font-serif text-[22px] text-semantic-success tracking-[-0.01em]">+€84/t</div>
              <div className="text-[10px] text-ink/50 mt-0.5">vs. your €184 cost</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal stack */}
      <SectionHeader
        num="02"
        eyebrow="Signal stack"
        title={<>Why the price is <em className="grad-text">moving.</em></>}
        subtitle="Every forecast carries its evidence. Click any signal to see the source articles, datasets, and historical correlation."
      />
      <div className="px-6 pb-8 max-w-3xl mx-auto">
        <div className="glass p-6">
          {signals.map((s) => (
            <div key={s.text} className="grid grid-cols-[28px_1fr_60px] gap-3 py-3 border-b border-ink/[0.05] last:border-b-0 items-center">
              <div className={`w-5.5 h-5.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-white font-semibold ${s.dir === "up" ? "bg-gradient-to-br from-semantic-success to-forest-500" : s.dir === "down" ? "bg-gradient-to-br from-semantic-alert to-[#c47070]" : "bg-ink/20"}`}>
                {s.dir === "up" ? "↑" : s.dir === "down" ? "↓" : "~"}
              </div>
              <div className="text-[13px] leading-[1.4]">
                <strong className="font-medium">{s.text}</strong>
                <span className="block text-[11px] text-ink/50 mt-0.5 font-mono">{s.sub}</span>
              </div>
              <div className={`font-mono text-[11px] text-right tabular-nums font-medium ${s.dir === "up" ? "text-semantic-success" : s.dir === "down" ? "text-semantic-alert" : "text-ink/50"}`}>
                {s.impact}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Window optimizer */}
      <SectionHeader
        num="03"
        eyebrow="Selling window optimizer"
        title={<>When to lock, <em className="grad-text">when to wait.</em></>}
        subtitle="For each 30-day window over the next year, the optimizer estimates expected price, risk-adjusted return, and basis. The agent doesn't tell you what to do — it tells you the math."
      />
      <div className="px-6 pb-8 max-w-3xl mx-auto">
        <div className="glass p-6">
          <h3 className="font-serif text-[22px] italic text-forest-700 m-0 mb-3.5 tracking-[-0.01em]">
            12-month selling-window heatmap
          </h3>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-1 mb-4">
            {months.map((m) => (
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
              Strong sell window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-1.5 rounded-sm bg-gradient-to-r from-harvest-500 to-harvest-200" />
              Acceptable
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-1.5 rounded-sm bg-gradient-to-r from-earth-600 to-[#c89070]" />
              Hold & hedge instead
            </span>
          </div>
        </div>
      </div>

      {/* ROI proof */}
      <SectionHeader
        num="04"
        eyebrow="What the desk delivered"
        title={<>Real numbers, <em className="grad-text">not promises.</em></>}
        subtitle="2024 vs 2025 sales by AgriNexus farmers using the market desk vs without it. Same crops, same regions."
      />
      <div className="px-6 pb-8 max-w-3xl mx-auto">
        <div className="glass p-7 text-center">
          <div className="font-serif text-6xl italic text-semantic-success tracking-[-0.025em] leading-none mb-2">+€18/t</div>
          <div className="text-[13px] text-ink/60 mb-4">average uplift on sold tonnage</div>
          <p className="text-xs text-ink/50 max-w-md mx-auto leading-[1.5]">
            Across 1,840 wheat farms in 2025, those who followed Market Agent signals realized €18.42 more per tonne on average. For a 300-hectare farm at 6 t/ha yield, that&apos;s €33,156 in additional gross margin per year — for a tool that costs nothing.
          </p>
        </div>
      </div>

      <section className="py-14 px-8 max-w-3xl mx-auto text-center">
        <h2 className="font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em] mb-3 bg-gradient-to-br from-ink to-forest-700 bg-clip-text text-transparent">
          Get the same intelligence
          <br />
          the desks have.
        </h2>
        <p className="text-sm text-ink/55 mb-6">It comes turned on, day one. Free. Forever.</p>
        <CTARow>
          <CTA href="/dashboard">Open the desk →</CTA>
          <CTA href="/agents" variant="secondary">Meet MarketAgent</CTA>
        </CTARow>
      </section>

    </>
  );
}
