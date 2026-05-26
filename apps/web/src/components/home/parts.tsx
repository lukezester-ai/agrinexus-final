import Link from "next/link";

export function ThreePillars() {
  const pillars = [
    { icon: "📡", title: "It watches", desc: "Satellites, sensors, weather, and 200 market sources, every minute." },
    { icon: "🧠", title: "It thinks",  desc: "18 specialist agents reason together — agronomist, trader, treasurer." },
    { icon: "⚡", title: "It acts",    desc: "Irrigates a field, hedges a contract, books the harvester. With your nod." },
  ];

  return (
    <section className="py-12 px-8 max-w-3xl mx-auto grid md:grid-cols-3 gap-3.5">
      {pillars.map((p) => (
        <div key={p.title} className="glass p-5">
          <div className="w-9 h-9 bg-gradient-to-br from-forest-700/10 to-harvest-500/10 rounded-[10px] flex items-center justify-center mb-3.5 text-forest-700 text-lg">
            {p.icon}
          </div>
          <div className="text-sm font-medium mb-1 tracking-[-0.005em]">{p.title}</div>
          <div className="text-[12.5px] text-ink/55 leading-[1.5]">{p.desc}</div>
        </div>
      ))}
    </section>
  );
}

export function FarmerQuote() {
  return (
    <section className="py-10 px-8 max-w-xl mx-auto text-center">
      <p className="font-serif text-[22px] font-normal italic leading-[1.4] text-ink mb-4 tracking-[-0.005em]">
        &ldquo;It told me to sell on a Tuesday morning. By Friday the price had dropped €22. That one call paid for years of work.&rdquo;
      </p>
      <div className="text-xs text-ink/50 flex items-center gap-2.5 justify-center">
        <span className="w-5.5 h-5.5 rounded-full bg-gradient-to-br from-harvest-500 to-harvest-200 text-white text-[10px] font-medium flex items-center justify-center w-[22px] h-[22px]">
          M
        </span>
        <span>Marko Petrov · 280 ha wheat · Dobrich</span>
      </div>
    </section>
  );
}

export function SponsorBand() {
  return (
    <section className="py-10 px-8 max-w-3xl mx-auto">
      <div className="glass p-6 md:p-7 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <div className="font-mono text-[10px] text-ink/45 tracking-[0.08em] uppercase mb-1.5">
            {"// Make this possible"}
          </div>
          <h3 className="font-serif text-xl font-normal tracking-[-0.015em] mb-1.5 leading-[1.3]">
            Free for farmers, <em className="grad-text">because of partners.</em>
          </h3>
          <p className="text-[12.5px] text-ink/60 leading-[1.5]">
            Companies, foundations and brands fund AgriNexus so every farmer keeps access. Sponsor a region, partner on research, or place your brand where it matters.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <Link
            href="/sponsors"
            className="bg-ink text-white py-2.5 px-5 rounded-full text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap hover:bg-ink/90 transition-colors"
          >
            Become a sponsor →
          </Link>
          <Link
            href="/sponsors#advertise"
            className="bg-transparent text-ink py-2.5 px-5 rounded-full text-xs font-medium border border-ink/25 inline-flex items-center gap-1 whitespace-nowrap hover:bg-ink/[0.03] transition-colors"
          >
            Advertise with us
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="py-14 px-8 max-w-3xl mx-auto text-center">
      <h2 className="font-serif text-3xl font-normal leading-[1.15] tracking-[-0.02em] mb-3 bg-gradient-to-br from-ink via-ink/80 to-forest-700 bg-clip-text text-transparent">
        Start with one field.
        <br />
        Watch what changes.
      </h2>
      <p className="text-sm text-ink/55 mb-6">
        No card. No setup. Just sign in and the agents take it from there.
      </p>
      <div className="inline-flex gap-2.5 items-center flex-wrap justify-center">
        <Link
          href="/dashboard"
          className="bg-ink text-white px-6 py-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 shadow-[0_6px_18px_rgba(10,10,10,0.2)] hover:bg-ink/90 transition-colors"
        >
          Start free →
        </Link>
        <Link
          href="/academy"
          className="bg-white/75 backdrop-blur-xl text-ink px-6 py-3 rounded-full text-[13px] font-medium border border-ink/10 inline-flex items-center gap-1.5 hover:bg-white/90 transition-colors"
        >
          Browse the academy
        </Link>
      </div>
    </section>
  );
}
