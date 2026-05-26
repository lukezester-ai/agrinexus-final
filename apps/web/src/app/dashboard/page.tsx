import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your farm, summarized. Daily briefing, agent activity, market positions.",
};

const sideItems = {
  daily: [
    { icon: "🏠", label: "Briefing", href: "/dashboard", active: true },
    { icon: "📋", label: "Fields",   href: "#", badge: "8" },
    { icon: "📈", label: "Market",   href: "/market" },
    { icon: "💰", label: "Finance",  href: "#" },
  ],
  mesh: [
    { icon: "🤖", label: "Agents",          href: "/agents", badge: "18" },
    { icon: "💬", label: "Ask AgriNexus",   href: "#" },
  ],
  more: [
    { icon: "🎓", label: "Academy",  href: "/academy" },
    { icon: "⚙",  label: "Settings", href: "#" },
  ],
};

const briefings = [
  { tag: "MARKET", tagClass: "bg-forest-700/10 text-forest-700",      meta: "4 agents consulted", text: <>Wheat opened <span className="text-semantic-success font-medium">+2.4%</span>. Your 60t at <strong className="font-medium">€246</strong> · this is a strong forward window.</>, cta: "See full analysis" },
  { tag: "FIELD",  tagClass: "bg-earth-600/15 text-harvest-700",      meta: "SatelliteAgent",     text: <>NDVI drop in <strong className="font-medium">Field A-204, south block</strong>. Possible early septoria · drone scout dispatched.</>, cta: "See the stress zone" },
  { tag: "OPS",    tagClass: "bg-semantic-info/[0.12] text-semantic-info", meta: "WeatherAgent + IrrigationAgent", text: <>14mm rain at <strong className="font-medium">17:00</strong> · irrigation paused, pump rerouted to greenhouse 2.</>, cta: "See forecast" },
];

const fields = [
  { swatch: "#1f4d2c", name: "A-205", ha: "42 ha", crop: "Wheat",     stat: "0.84", status: "healthy" as const },
  { swatch: "#c4a86a", name: "A-204", ha: "87 ha", crop: "Wheat",     stat: "0.58", status: "alert" as const },
  { swatch: "#5a9968", name: "A-202", ha: "35 ha", crop: "Sunflower", stat: "0.76", status: "healthy" as const },
  { swatch: "#97c459", name: "A-203", ha: "28 ha", crop: "Rapeseed",  stat: "0.71", status: "ok" as const },
];

const agentFeed = [
  { icon: "📈", tag: "MKT", time: "06:42", text: <>Wheat <strong className="font-medium">+2.4%</strong> · forward window flagged</>, status: "pending" as const, statusText: "⏵ Awaiting your tap" },
  { icon: "💧", tag: "IRR", time: "06:18", text: <>Paused irrigation on <strong className="font-medium">A-204</strong> · rain at 17:00</>, status: "done" as const, statusText: "✓ Executed (L4 autonomy)" },
  { icon: "🛰️", tag: "SAT", time: "05:50", text: <>NDVI drop in <strong className="font-medium">A-204 south</strong> · 2.3 ha flagged</>, status: "done" as const, statusText: "✓ Drone dispatched" },
  { icon: "🦠", tag: "DIS", time: "04:12", text: <>Septoria probability <strong className="font-medium">78%</strong> · scout report queued</>, status: "pending" as const, statusText: "⏵ Confirm treatment plan" },
];

const weather = [
  { dow: "Today", icon: "🌧", high: "22°", low: "14°", rain: "14mm",  today: true },
  { dow: "Sat",   icon: "☁",  high: "19°", low: "12°", rain: "2mm" },
  { dow: "Sun",   icon: "⛅", high: "23°", low: "13°", rain: "—" },
  { dow: "Mon",   icon: "☀",  high: "26°", low: "15°", rain: "—" },
  { dow: "Tue",   icon: "⛈",  high: "21°", low: "14°", rain: "28mm" },
];

const tasks = [
  { done: false, title: "Confirm septoria treatment for A-204", meta: "Due 11:00 · before rain", from: "DIS" },
  { done: false, title: "Approve 144t wheat forward at €246",   meta: "Window closes 16:00",     from: "MKT" },
  { done: true,  title: "Review weekly sustainability report",  meta: "Done · 06:15",            from: "CO2" },
  { done: false, title: "Call Stefan about combine maintenance", meta: "Self-added · this week", from: "YOU" },
];

function SidebarGroup({ label, items }: { label: string; items: { icon: string; label: string; href: string; active?: boolean; badge?: string }[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[9px] text-ink/40 tracking-[0.1em] uppercase px-2 pb-1.5">{label}</div>
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          className={
            "flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-[13px] no-underline transition-colors " +
            (i.active ? "bg-ink/[0.06] text-ink font-medium" : "text-ink/65 hover:bg-ink/[0.04]")
          }
        >
          <span>{i.icon}</span>
          <span>{i.label}</span>
          {i.badge && <span className="ml-auto text-[9px] py-px px-1.5 rounded-full bg-forest-700/10 text-forest-700 font-medium font-mono">{i.badge}</span>}
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#f6f3ec] relative z-[2]">

      <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-paper/85 backdrop-blur-xl border-r border-ink/[0.06] py-5 px-3.5 flex-col gap-4.5 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2 py-1 px-1.5 pb-3 no-underline text-ink">
          <span className="w-5.5 h-5.5 w-[22px] h-[22px] rounded-md bg-brand-gradient flex items-center justify-center text-white text-xs shadow-[0_2px_8px_rgba(31,77,44,0.25)]">✦</span>
          <span className="text-[13px] font-medium">AgriNexus</span>
        </Link>

        <SidebarGroup label="Daily" items={sideItems.daily} />
        <SidebarGroup label="Mesh"  items={sideItems.mesh} />
        <SidebarGroup label="More"  items={sideItems.more} />

        <div className="mt-auto p-3 px-2 bg-white/50 rounded-[10px] flex items-center gap-2.5">
          <div className="w-7.5 h-7.5 w-[30px] h-[30px] rounded-full bg-gradient-to-br from-harvest-500 to-earth-600 text-white text-xs font-medium flex items-center justify-center flex-shrink-0">MP</div>
          <div>
            <div className="text-xs font-medium">Marko P.</div>
            <div className="text-[10px] text-ink/50">Dobrich · 280 ha</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 py-5 px-6 md:px-7 pb-12 min-w-0 relative">

        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-serif text-2xl md:text-[26px] font-normal tracking-[-0.015em] leading-[1.1]">
              Good morning, <em className="grad-text">Marko.</em>
            </div>
            <div className="text-[11px] text-ink/50 mt-1 font-mono">Friday · 22 May 2026 · 06:42 EET</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex bg-white/65 backdrop-blur-md border border-ink/[0.06] rounded-full py-2 px-3.5 text-xs text-ink/50 items-center gap-2 min-w-[220px]">
              <span>Ask anything…</span>
              <span className="font-mono text-[9px] py-px px-1.5 border border-ink/15 rounded ml-auto">⌘K</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/65 backdrop-blur-md border border-ink/[0.06] flex items-center justify-center cursor-pointer text-sm relative">
              🔔
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-semantic-warning border-[1.5px] border-[#f6f3ec]" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/65 backdrop-blur-md border border-ink/[0.06] flex items-center justify-center cursor-pointer text-sm">💬</div>
          </div>
        </div>

        {/* Briefing */}
        <section className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-[18px] py-5 px-6 mb-3.5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {briefings.map((b, idx) => (
            <div key={b.tag} className={idx < briefings.length - 1 ? "md:pr-4 md:border-r border-ink/[0.06]" : ""}>
              <div className="flex items-center gap-2 text-[9px] text-ink/50 tracking-[0.08em] uppercase mb-2.5">
                <span className={`py-0.5 px-1.5 rounded font-mono font-medium tracking-[0.06em] ${b.tagClass}`}>{b.tag}</span>
                <span>{b.meta}</span>
              </div>
              <div className="text-[13.5px] leading-[1.45] text-ink mb-2.5">{b.text}</div>
              <span className="text-[11px] text-forest-700 cursor-pointer font-medium">{b.cta} →</span>
            </div>
          ))}
        </section>

        {/* Body grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <div className="flex flex-col gap-3.5">

            {/* Fields */}
            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-baseline py-3.5 px-4 pb-2.5">
                <div className="text-[13px] font-medium">Your fields</div>
                <div className="flex gap-1">
                  {["NDVI", "Moisture", "Yield est."].map((t, i) => (
                    <span key={t} className={`py-1 px-2.5 rounded-md font-mono text-[10px] tracking-[0.04em] cursor-pointer ${i === 0 ? "bg-ink text-white" : "text-ink/50"}`}>{t}</span>
                  ))}
                </div>
              </div>

              <div className="mx-4 mt-2 mb-3 h-[230px] rounded-xl overflow-hidden">
                <svg viewBox="0 0 460 230" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(10,10,10,0.04)" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="460" height="230" fill="url(#grid)"/>
                  <path d="M 20 20 L 140 25 L 145 90 L 25 95 Z"      fill="#5a9968" opacity="0.55"/>
                  <path d="M 145 25 L 270 28 L 268 88 L 145 90 Z"     fill="#7fb487" opacity="0.6"/>
                  <path d="M 268 28 L 380 30 L 382 95 L 268 88 Z"     fill="#97c459" opacity="0.55"/>
                  <path d="M 380 30 L 442 35 L 440 100 L 382 95 Z"    fill="#5a9968" opacity="0.5"/>
                  <path d="M 25 95 L 145 90 L 150 165 L 28 170 Z"    fill="#1f4d2c" opacity="0.55"/>
                  <path d="M 145 90 L 268 88 L 270 168 L 150 165 Z"  fill="#5a9968" opacity="0.5"/>
                  <path d="M 268 88 L 382 95 L 384 175 L 270 168 Z"  fill="#c4a86a" opacity="0.5"/>
                  <path d="M 382 95 L 440 100 L 438 178 L 384 175 Z" fill="#7fb487" opacity="0.55"/>
                  <circle cx="335" cy="135" r="5" fill="#b87a3d"/>
                  <circle cx="335" cy="135" r="10" fill="none" stroke="#b87a3d" strokeWidth="1" opacity="0.6">
                    <animate attributeName="r" from="5" to="22" dur="2.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" from="0.7" to="0" dur="2.2s" repeatCount="indefinite"/>
                  </circle>
                  <g transform="translate(335 135)">
                    <rect x="-44" y="-32" width="86" height="18" rx="3" fill="rgba(184,122,61,0.95)"/>
                    <text x="0" y="-19" textAnchor="middle" fontSize="9" fill="white" fontFamily="ui-monospace,monospace" fontWeight="500">A-204 · 2.3 ha</text>
                  </g>
                </svg>
              </div>

              <div className="px-4 pb-4 flex flex-col gap-px bg-ink/[0.04] rounded-[10px] overflow-hidden mx-4 mb-4">
                {fields.map((f) => (
                  <div key={f.name} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2.5 py-2.5 px-3.5 bg-[rgba(252,251,247,0.95)] items-center text-xs cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: f.swatch }} />
                    <div className="font-medium">{f.name} <span className="text-ink/45 font-normal text-[11px] ml-1.5">{f.ha}</span></div>
                    <div className="text-[11px] text-ink/55">{f.crop}</div>
                    <div className="font-mono text-[11px] text-ink/70">{f.stat}</div>
                    <span className={
                      f.status === "healthy" ? "text-[10px] py-px px-2 rounded font-medium bg-forest-700/10 text-forest-700" :
                      f.status === "alert"   ? "text-[10px] py-px px-2 rounded font-medium bg-earth-600/15 text-harvest-700" :
                                                "text-[10px] py-px px-2 rounded font-medium bg-ink/[0.06] text-ink/50"
                    }>
                      {f.status === "healthy" ? "Healthy" : f.status === "alert" ? "Stress" : "Watching"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Market positions */}
            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-baseline py-3.5 px-4 pb-2.5">
                <div className="text-[13px] font-medium">Market positions</div>
                <div className="text-[10px] text-ink/50 font-mono">MATIF · 06:42 live</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 py-1 px-4 pb-5">
                <div>
                  <div className="text-[10px] text-ink/50 font-mono tracking-[0.06em] mb-1">WHEAT · DEC26 · 480t reserve</div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-serif text-3xl tracking-[-0.02em]">€246</span>
                    <span className="text-[11px] text-semantic-success font-medium">+€8 today</span>
                  </div>
                  <div className="h-14 mt-2">
                    <svg viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id="mk-area-d" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#5a9968" stopOpacity="0.35"/>
                          <stop offset="100%" stopColor="#5a9968" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d="M 0 38 L 18 36 L 36 41 L 54 32 L 72 34 L 90 28 L 108 24 L 126 30 L 144 22 L 162 18 L 180 14 L 198 20 L 216 12 L 230 16 L 230 56 L 0 56 Z" fill="url(#mk-area-d)"/>
                      <path d="M 0 38 L 18 36 L 36 41 L 54 32 L 72 34 L 90 28 L 108 24 L 126 30 L 144 22 L 162 18 L 180 14 L 198 20 L 216 12 L 230 16" stroke="#1f4d2c" strokeWidth="1.4" fill="none"/>
                      <circle cx="230" cy="16" r="2.5" fill="#1f4d2c"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="py-2.5 px-3 bg-forest-700/[0.06] border border-forest-700/10 rounded-lg">
                    <div className="text-[9px] text-ink/50 tracking-[0.06em] uppercase mb-1">Forecast · Sep 30</div>
                    <div className="font-serif text-base text-forest-700">€268 ±€14</div>
                    <div className="text-[10px] text-forest-700/70">+€84/t over break-even</div>
                  </div>
                  <div className="flex gap-1.5 pt-3">
                    <button className="flex-1 py-2 px-2.5 rounded-lg text-[11px] cursor-pointer text-center font-medium border-none bg-ink text-white">Lock 144t</button>
                    <button className="flex-1 py-2 px-2.5 rounded-lg text-[11px] cursor-pointer text-center font-medium bg-transparent text-ink/65 border border-ink/[0.18]">Wait</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3.5">

            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-baseline py-3.5 px-4 pb-2.5">
                <div className="text-[13px] font-medium">Agent activity</div>
                <div className="text-[10px] text-ink/50 font-mono">last 6h · 23 actions</div>
              </div>
              <div className="px-4 pb-4">
                {agentFeed.map((a, idx) => (
                  <div key={idx} className="flex gap-2.5 py-2.5 border-b border-ink/[0.05] last:border-b-0">
                    <div className="w-6 h-6 rounded-md bg-white/60 border border-ink/[0.06] flex items-center justify-center text-[11px] flex-shrink-0">{a.icon}</div>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-0.5">
                        <span className="font-mono text-[9px] text-ink/50 tracking-[0.06em] py-px px-1.5 bg-ink/[0.04] rounded-sm">{a.tag}</span>
                        <span className="text-[10px] text-ink/40">{a.time}</span>
                      </div>
                      <div className="text-xs leading-[1.4]">{a.text}</div>
                      <div className={`mt-1 text-[10px] ${a.status === "done" ? "text-semantic-success" : "text-harvest-700"}`}>{a.statusText}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weather */}
            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-baseline py-3.5 px-4 pb-2.5">
                <div className="text-[13px] font-medium">Weather · Dobrich</div>
                <div className="text-[10px] text-ink/50 font-mono">7-day · hyper-local</div>
              </div>
              <div className="grid grid-cols-5">
                {weather.map((d) => (
                  <div key={d.dow} className={`py-3 px-1.5 text-center border-r border-ink/[0.05] last:border-r-0 ${d.today ? "bg-forest-700/[0.04]" : ""}`}>
                    <div className="text-[10px] text-ink/50 font-mono mb-2 tracking-[0.06em] uppercase">{d.dow}</div>
                    <div className="text-[22px] mb-1.5">{d.icon}</div>
                    <div className="text-[13px] font-medium mb-1">{d.high}<span className="text-ink/40 font-normal text-[11px]"> / {d.low}</span></div>
                    <div className="text-[10px] text-semantic-info">{d.rain}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-baseline py-3.5 px-4 pb-2.5">
                <div className="text-[13px] font-medium">Today&apos;s tasks</div>
                <div className="text-[10px] text-ink/50 font-mono">3 from agents · 1 from you</div>
              </div>
              <div className="px-4 pb-4 flex flex-col gap-1.5">
                {tasks.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 py-2 px-2.5 bg-white/50 rounded-lg cursor-pointer">
                    <span className={`w-3.5 h-3.5 rounded flex-shrink-0 relative ${t.done ? "bg-gradient-to-br from-forest-700 to-forest-500 border border-forest-700" : "border border-ink/25"}`}>
                      {t.done && <span className="absolute top-[2px] left-1 w-1 h-[7px] border-r-[1.5px] border-b-[1.5px] border-white rotate-45" />}
                    </span>
                    <div className="flex-1">
                      <div className={`text-xs ${t.done ? "text-ink/40 line-through" : ""}`}>{t.title}</div>
                      <div className="text-[10px] text-ink/45 mt-px">{t.meta}</div>
                    </div>
                    <span className="font-mono text-[9px] py-px px-1.5 bg-ink/[0.04] text-ink/55 rounded-sm tracking-[0.04em] ml-auto">{t.from}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center py-5 text-[11px] text-ink/40">
          <Link href="/dashboard/mobile" className="hover:text-ink">📱 View mobile version</Link> · <Link href="/" className="hover:text-ink">← Home</Link>
        </div>
      </main>
    </div>
  );
}
