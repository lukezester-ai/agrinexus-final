import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Dashboard · Mobile",
  description: "AgriNexus mobile dashboard preview.",
};

const needs = [
  { icon: "🦠", meta: "DISEASE · 11:00 deadline", title: "Confirm septoria treatment for A-204",
    actions: [{ label: "Approve", primary: true }, { label: "Review", primary: false }] },
  { icon: "📈", meta: "MARKET · closes 16:00",   title: "Lock 144t wheat forward", sub: "at €246 · +€84 over break-even",
    actions: [{ label: "Lock at €246", primary: true }, { label: "Wait", primary: false }] },
];

const phoneFields = [
  { color: "var(--c-warning)", name: "A-204", meta: "· 87 ha · wheat",     statText: "NDVI 0.58 · stress zone 2.3 ha", statClass: "text-semantic-warning" },
  { color: "#2D7A3F",          name: "A-205", meta: "· 42 ha · wheat",     statText: "NDVI 0.84 · healthy",            statClass: "text-semantic-success" },
  { color: "#2D7A3F",          name: "A-202", meta: "· 35 ha · sunflower", statText: "NDVI 0.76 · healthy",            statClass: "text-semantic-success" },
];

const phoneWeather = [
  { dow: "TODAY", icon: "🌧", t: "22°", r: "14mm", today: true },
  { dow: "SAT",   icon: "☁",  t: "19°", r: "2mm" },
  { dow: "SUN",   icon: "☀",  t: "23°", r: "—" },
  { dow: "MON",   icon: "☀",  t: "26°", r: "—" },
];

const phoneActivity = [
  { tag: "IRR", tagClass: "bg-semantic-success/[0.12] text-semantic-success", text: "Paused A-204 irrigation · rain incoming", sub: "06:18 · auto-executed", subClass: "text-ink/45" },
  { tag: "SAT", tagClass: "bg-semantic-info/[0.12] text-semantic-info",        text: "NDVI drop in A-204 south · drone sent", sub: "05:50 · auto-executed", subClass: "text-ink/45" },
  { tag: "DIS", tagClass: "bg-earth-600/[0.18] text-semantic-warning",         text: "Septoria 78% probability · awaiting you", sub: "04:12 · pending", subClass: "text-semantic-warning" },
];

export default function DashboardMobilePage() {
  return (
    <div className="min-h-screen bg-[#e8e3d5] flex justify-center p-3.5 relative z-[2]">
      <div className="w-[380px] max-w-full bg-paper rounded-[32px] overflow-hidden shadow-[0_30px_60px_-20px_rgba(10,10,10,0.25)] border border-ink/[0.06]">

        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-[110px] h-1.5 bg-ink/[0.18] rounded-full" />
        </div>

        <div className="py-2.5 px-5.5 px-[22px] flex justify-between items-center text-xs pt-2.5 pb-1.5">
          <div className="font-medium">06:42</div>
          <div className="flex gap-1.5 opacity-60 text-xs">
            <span>📶</span><span>🔋</span>
          </div>
        </div>

        <div className="py-4 px-5.5 px-[22px] pb-5 flex justify-between items-start">
          <div>
            <div className="font-serif text-[22px] font-medium leading-[1.15]">
              Good morning,<br />Marko.
            </div>
            <div className="text-xs text-ink/50 mt-1">Fri 22 May · Dobrich</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-semantic-info/[0.12] flex items-center justify-center text-sm font-medium text-semantic-info relative">
            MP
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-semantic-warning rounded-full border-[2.5px] border-paper" />
          </div>
        </div>

        {/* Briefing card */}
        <div className="mx-4 mb-4 bg-semantic-info/[0.08] rounded-2xl p-4 border border-ink/[0.05]">
          <div className="flex justify-between items-center mb-3.5">
            <div className="text-[11px] text-semantic-info tracking-[0.06em] uppercase font-medium">Today&apos;s briefing</div>
            <div className="text-[11px] text-semantic-info flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-semantic-success rounded-full" />
              Live
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5 items-start">
              <span className="font-mono text-[9px] py-0.5 px-1.5 rounded tracking-[0.04em] font-medium flex-shrink-0 mt-px bg-forest-700/12 text-forest-700">MKT</span>
              <div className="text-[13px] leading-[1.45] text-semantic-info">Wheat <span className="text-semantic-success font-medium">+2.4%</span>. Strong forward window at <strong className="font-medium">€246</strong>.</div>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="font-mono text-[9px] py-0.5 px-1.5 rounded tracking-[0.04em] font-medium flex-shrink-0 mt-px bg-earth-600/[0.18] text-harvest-700">FLD</span>
              <div className="text-[13px] leading-[1.45] text-semantic-info">Stress zone in <strong className="font-medium">A-204 south</strong>. Possible septoria.</div>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="font-mono text-[9px] py-0.5 px-1.5 rounded tracking-[0.04em] font-medium flex-shrink-0 mt-px bg-white/60 text-ink/60">OPS</span>
              <div className="text-[13px] leading-[1.45] text-semantic-info">14mm rain at 17:00. Irrigation paused.</div>
            </div>
          </div>
        </div>

        {/* Needs you */}
        <div className="px-4 pb-3 flex justify-between items-baseline">
          <div className="text-[13px] font-medium">Needs you</div>
          <div className="text-xs text-ink/40">2 actions</div>
        </div>
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {needs.map((n) => (
            <div key={n.title} className="bg-[#fcfbf7] border border-ink/[0.06] rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{n.icon}</span>
                <span className="text-[11px] text-ink/50 font-mono tracking-[0.04em]">{n.meta}</span>
              </div>
              <div className="text-sm font-medium leading-[1.35] mb-1">{n.title}</div>
              {n.sub && <div className="text-xs text-ink/65 mb-2.5">{n.sub}</div>}
              <div className="flex gap-2">
                {n.actions.map((a) => (
                  <button key={a.label} className={`flex-1 min-h-[38px] rounded-[10px] text-[13px] font-medium border-none cursor-pointer ${a.primary ? "bg-ink text-white" : "bg-transparent text-ink border border-ink/[0.18]"}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Fields */}
        <div className="px-4 pb-3 flex justify-between items-baseline">
          <div className="text-[13px] font-medium">Fields</div>
          <div className="text-xs text-ink/40">8 total →</div>
        </div>
        <div className="mx-4 mb-4 bg-[#fcfbf7] border border-ink/[0.06] rounded-2xl overflow-hidden">
          {phoneFields.map((f) => (
            <div key={f.name} className="flex items-center gap-3 p-3.5 border-b border-ink/[0.05] last:border-b-0 cursor-pointer">
              <div className="w-2 h-9 rounded-sm flex-shrink-0" style={{ background: f.color }} />
              <div className="flex-1">
                <div className="text-[13px] font-medium">{f.name} <span className="text-ink/45 font-normal text-[11px] ml-1">{f.meta}</span></div>
                <div className={`text-[11px] mt-px ${f.statClass}`}>{f.statText}</div>
              </div>
              <div className="text-sm text-ink/35">›</div>
            </div>
          ))}
        </div>

        {/* Weather */}
        <div className="px-4 pb-3 flex justify-between items-baseline">
          <div className="text-[13px] font-medium">Weather</div>
          <div className="text-xs text-ink/40">Dobrich · hyper-local</div>
        </div>
        <div className="mx-4 mb-4 bg-[#fcfbf7] border border-ink/[0.06] rounded-2xl p-3.5 flex justify-between gap-1.5">
          {phoneWeather.map((d) => (
            <div key={d.dow} className={`flex-1 text-center py-1 rounded-[10px] ${d.today ? "bg-semantic-info/[0.08]" : ""}`}>
              <div className={`text-[10px] font-mono font-medium mb-1 ${d.today ? "text-semantic-info" : "text-ink/50"}`}>{d.dow}</div>
              <div className="text-[22px] mb-1">{d.icon}</div>
              <div className="text-[13px] font-medium">{d.t}</div>
              <div className="text-[10px] text-ink/45">{d.r}</div>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div className="px-4 pb-3 flex justify-between items-baseline">
          <div className="text-[13px] font-medium">Agent activity</div>
          <div className="text-xs text-ink/40">last 6h</div>
        </div>
        <div className="mx-4 mb-4 bg-[#fcfbf7] border border-ink/[0.06] rounded-2xl py-3 px-3.5">
          {phoneActivity.map((a, idx) => (
            <div key={idx} className="flex gap-2.5 py-2 border-b border-ink/[0.05] last:border-b-0">
              <span className={`font-mono text-[9px] py-0.5 px-1.5 rounded tracking-[0.04em] font-medium flex-shrink-0 h-fit ${a.tagClass}`}>{a.tag}</span>
              <div className="flex-1 text-xs leading-[1.45]">
                {a.text}
                <div className={`text-[10px] mt-0.5 ${a.subClass}`}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Ask button */}
        <button className="mx-4 mb-4 w-[calc(100%-32px)] min-h-[52px] bg-ink text-white border-none rounded-full text-sm font-medium flex items-center justify-center gap-2.5 cursor-pointer">
          🎙 Ask AgriNexus
        </button>

        {/* Tab bar */}
        <div className="grid grid-cols-4 border-t border-ink/[0.06] bg-[#fcfbf7]">
          <Link href="#" className="py-3 pb-4 text-center text-ink no-underline flex flex-col items-center gap-1">
            <span className="text-[22px]">🏠</span>
            <span className="text-[10px] font-medium">Today</span>
          </Link>
          <Link href="#" className="py-3 pb-4 text-center text-ink/40 no-underline flex flex-col items-center gap-1">
            <span className="text-[22px]">📋</span>
            <span className="text-[10px]">Fields</span>
          </Link>
          <Link href="/market" className="py-3 pb-4 text-center text-ink/40 no-underline flex flex-col items-center gap-1">
            <span className="text-[22px]">📈</span>
            <span className="text-[10px]">Market</span>
          </Link>
          <Link href="#" className="py-3 pb-4 text-center text-ink/40 no-underline flex flex-col items-center gap-1">
            <span className="text-[22px]">⋯</span>
            <span className="text-[10px]">More</span>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-3 text-center text-[11px] text-ink/40 w-full">
        <Link href="/dashboard" className="hover:text-ink">🖥 View desktop version</Link> · <Link href="/" className="hover:text-ink">← Home</Link>
      </div>
    </div>
  );
}
