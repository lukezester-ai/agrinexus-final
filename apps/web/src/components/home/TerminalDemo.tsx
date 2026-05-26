const agents = [
  { color: "#1f4d2c", text: "MarketAgent: detected ±2.1σ price move",         tag: "MKT" },
  { color: "#5a9968", text: "NewsAgent: parsed 142 sources overnight",        tag: "NWS" },
  { color: "#c4a86a", text: "FinanceAgent: break-even confirmed €184/t",     tag: "FIN" },
  { color: "#b87a3d", text: "WeatherAgent: dry US Plains, bullish bias",      tag: "WTR" },
];

const signals = [
  { color: "#2d7a3f", text: "Russia export quota extended",   delta: "+0.9%" },
  { color: "#2d7a3f", text: "US Plains drought index +12",     delta: "+0.7%" },
  { color: "#b87a3d", text: "EUR weaker vs USD",                delta: "+0.5%" },
  { color: "#a85050", text: "Argentine harvest +3% YoY",       delta: "−0.3%" },
];

export function TerminalDemo() {
  return (
    <section id="demo" className="px-6 pt-10 pb-7 max-w-3xl mx-auto">
      <div className="bg-white/60 backdrop-blur-2xl border border-white/70 rounded-[22px] p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_40px_80px_-24px_rgba(10,10,10,0.22),0_16px_32px_-16px_rgba(31,77,44,0.15)]">
        <div className="bg-[rgba(252,251,247,0.92)] rounded-[18px] overflow-hidden">

          {/* Terminal head */}
          <div className="flex items-center justify-between py-3.5 px-5 border-b border-ink/[0.06]">
            <div className="text-xs text-ink/55 flex items-center gap-2 font-medium">
              <span className="live-dot" /> Daily Briefing · 06:42 EET
            </div>
            <div className="flex gap-4 text-[11px] text-ink/40">
              <span className="text-ink font-medium">Market</span>
              <span>Field</span>
              <span>Cashflow</span>
            </div>
          </div>

          {/* Terminal body */}
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-px bg-ink/[0.05]">

            {/* Left — recommendation */}
            <div className="bg-[rgba(252,251,247,0.92)] py-4 px-5">
              <div className="text-[10px] text-ink/45 tracking-[0.08em] uppercase mb-2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-brand-gradient flex items-center justify-center text-white text-[10px]">✦</span>
                AgriNexus · 4 agents consulted
              </div>
              <div className="text-lg font-medium tracking-[-0.015em] mb-2.5 leading-[1.25]">
                Wheat opened <span className="text-semantic-success font-medium tabular-nums">+2.4%</span> on Black Sea export news
              </div>
              <p className="text-[12.5px] text-ink/65 leading-[1.55] mb-3">
                Russia signaled extended export quotas overnight. Your local cash equivalent climbed from{" "}
                <strong className="font-medium text-ink">€238 → €246/t</strong>. With 60t still uncontracted, this is a strong window for a{" "}
                <strong className="font-medium text-ink">forward contract through October</strong>.
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <span className="bg-forest-700/[0.07] border border-forest-700/[0.15] text-forest-700 py-1 px-2.5 rounded text-[11px] font-medium inline-flex items-center gap-1">
                  ✓ Lock 60t @ €246
                </span>
                <span className="bg-harvest-500/10 border border-harvest-500/25 text-harvest-700 py-1 px-2.5 rounded text-[11px] font-medium">
                  ⏵ Wait for USDA
                </span>
                <span className="bg-harvest-500/10 border border-harvest-500/25 text-harvest-700 py-1 px-2.5 rounded text-[11px] font-medium">
                  Full analysis
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-ink/[0.06]">
                <div className="text-[10px] text-ink/45 tracking-[0.06em] uppercase mb-2">Behind this call</div>
                <div className="flex flex-col gap-1.5">
                  {agents.map((a) => (
                    <div key={a.tag} className="flex items-center gap-2 text-[11px] text-ink/70">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      {a.text}
                      <span className="font-mono text-[9px] text-ink/40 ml-auto">[{a.tag}]</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — forecast chart */}
            <div className="bg-[rgba(252,251,247,0.92)] py-4 px-5">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[11px] text-ink/55 font-medium">Wheat · 90d forecast</span>
                <span className="text-[10px] text-ink/40">78% conf.</span>
              </div>

              <div className="h-[120px]">
                <svg viewBox="0 0 260 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="mk-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#5a9968" stopOpacity="0.35"/>
                      <stop offset="100%" stopColor="#5a9968" stopOpacity="0"/>
                    </linearGradient>
                    <linearGradient id="mk-conf" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#c4a86a" stopOpacity="0.15"/>
                      <stop offset="100%" stopColor="#c4a86a" stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  <g opacity="0.3">
                    <line x1="0" y1="30" x2="260" y2="30" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,3"/>
                    <line x1="0" y1="60" x2="260" y2="60" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,3"/>
                    <line x1="0" y1="90" x2="260" y2="90" stroke="#0a0a0a" strokeWidth="0.3" strokeDasharray="2,3"/>
                  </g>
                  <path d="M 120 30 Q 160 25 200 35 T 260 40 L 260 90 Q 200 80 160 75 T 120 80 Z" fill="url(#mk-conf)"/>
                  <path d="M 0 75 L 10 73 L 20 78 L 30 70 L 40 72 L 50 68 L 60 65 L 70 70 L 80 62 L 90 58 L 100 55 L 110 60 L 120 52 L 120 88 L 0 88 Z" fill="url(#mk-area)"/>
                  <path d="M 0 75 L 10 73 L 20 78 L 30 70 L 40 72 L 50 68 L 60 65 L 70 70 L 80 62 L 90 58 L 100 55 L 110 60 L 120 52" stroke="#1f4d2c" strokeWidth="1.5" fill="none"/>
                  <path d="M 120 52 Q 150 45 180 50 T 230 48 T 260 50" stroke="#c4a86a" strokeWidth="1.5" fill="none" strokeDasharray="3,2"/>
                  <line x1="120" y1="0" x2="120" y2="120" stroke="#0a0a0a" strokeWidth="0.4" strokeDasharray="2,2" opacity="0.3"/>
                  <circle cx="120" cy="52" r="3" fill="#1f4d2c"/>
                  <circle cx="120" cy="52" r="6" fill="none" stroke="#1f4d2c" strokeWidth="0.5" opacity="0.4"/>
                  <circle cx="200" cy="49" r="3" fill="#c4a86a"/>
                  <text x="206" y="46" fontSize="9" fill="#8a6a2f" fontWeight="500">€268</text>
                  <text x="2" y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">Jun</text>
                  <text x="62" y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">Jul</text>
                  <text x="118" y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">Today</text>
                  <text x="180" y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">Sep</text>
                  <text x="240" y="116" fontSize="8" fill="#0a0a0a" opacity="0.5">Oct</text>
                </svg>
              </div>

              <div className="flex justify-between items-baseline mt-1.5 text-[10px] text-ink/45">
                <span>Now <strong className="text-ink font-medium">€246</strong></span>
                <span className="text-semantic-success font-medium">Target Sep 30 · €268 ±€14</span>
              </div>

              <div className="mt-3 pt-3 border-t border-ink/[0.06]">
                <div className="text-[10px] text-ink/45 tracking-[0.06em] uppercase mb-2">Signal stack</div>
                <div className="flex flex-col gap-1.5">
                  {signals.map((s) => (
                    <div key={s.text} className="flex items-center gap-2 text-[11px] text-ink/70">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      {s.text}
                      <span className="font-mono text-[9px] text-ink/40 ml-auto">{s.delta}</span>
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
