import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { SectionHeader } from "@/components/SectionHeader";
import { CTA, CTARow } from "@/components/CTA";

export const metadata: Metadata = {
  title: "Sponsorship & advertising",
  description:
    "Three ways to stand with farmers: Seed, Harvest, Foundation. Sponsorship never influences agent recommendations.",
};

const tiers = [
  {
    name: "Seed",
    forWhom: "Startups & regional brands",
    price: "€500",
    unit: "/ month · annual commit",
    perks: ["Logo on Sponsors page", "Quarterly impact report", "Newsletter mention", "Annual recognition post"],
    impact: "Funds ~10 farms / month",
    cta: "Become a Seed sponsor",
    featured: false,
  },
  {
    name: "Harvest",
    forWhom: "Agritech & banking partners",
    price: "€2,500",
    unit: "/ month · annual commit",
    perks: [
      "Featured logo + landing badge",
      "Co-branded research reports",
      "Anonymized dataset access",
      "Co-hosted farmer webinars",
      "Dedicated account manager",
    ],
    impact: "Funds ~60 farms / month",
    cta: "Become a Harvest partner",
    featured: true,
  },
  {
    name: "Foundation",
    forWhom: "Governments & NGOs",
    price: "Custom",
    unit: "strategic partnership",
    perks: [
      "Named agent or region",
      "Strategic advisory seat",
      "Custom ESG / CSR reports",
      "Joint press & field programs",
      "White-paper co-authorship",
    ],
    impact: "Funds entire countries",
    cta: "Open a conversation",
    featured: false,
  },
];

const wallTiers = [
  { label: "Foundation partners", size: "text-xl", color: "text-ink",
    logos: ["Gates Foundation", "FAO", "European Commission"] },
  { label: "Harvest sponsors",    size: "text-base", color: "text-ink",
    logos: ["Syngenta", "Rabobank", "Bayer", "DSM"] },
  { label: "Seed sponsors",       size: "text-[13px]", color: "text-ink/65",
    logos: ["John Deere", "UniCredit", "Yara", "Trimble", "Claas", "+ 19 more"] },
];

const ads = [
  { icon: "📩", name: "Daily Briefing slot",      desc: "A native card in the morning briefing — relevant to crop, season, and recent agent activity. Read by 89% of active users.", specs: ["CPM €18", "Native format", "Crop-targeted"] },
  { icon: "📊", name: "Dashboard banner",         desc: "A subtle placement on the main dashboard, rotating across sponsors. High visibility, low intrusion.", specs: ["CPM €12", "Geo-targeted", "Rotated"] },
  { icon: "🎙️", name: "Podcast sponsorship",      desc: "Host-read messages in The Field Notes podcast. 42k listeners, 38-minute average completion.",       specs: ["From €2k / ep", "Host-read", "14-day exclusivity"] },
  { icon: "📚", name: "Academy article sponsor",  desc: '"Brought to you by" credit on a learning path or single article. No content control.',           specs: ["From €800 / article", "Permanent"] },
];

const faqs = [
  {
    q: "Does sponsorship influence which agents recommend what?",
    a: "No, ever. There's a hard wall between sponsorship and agent reasoning. Every recommendation carries its data sources, and they're always agronomic or financial — never commercial. We've published the architecture so anyone can verify.",
  },
  {
    q: "What data is shared with sponsors?",
    a: 'Only aggregated, anonymized insights — e.g. "65% of Bulgarian wheat farms following AgriNexus recommendations saw +€18/t". Never personal farm data, never named farmers. Sponsors at the Harvest tier and above get full data documentation.',
  },
  {
    q: "How is impact measured and reported?",
    a: "Quarterly impact reports per sponsor, with farms supported, hectares monitored, yield gained, CO₂ avoided. Foundation partners receive custom ESG-grade reporting with auditable methodology.",
  },
  {
    q: "Can I sponsor a specific region or crop?",
    a: 'Yes, especially at the Harvest and Foundation tiers. A common pattern: "Sponsor 100 wheat farms in Bulgaria for one year." We design the package with you.',
  },
];

export default function SponsorsPage() {
  return (
    <>
      <Hero
        eyebrow="// Sponsors & advertise"
        title={
          <>
            Free for farmers,
            <br />
            because of <em className="grad-text not-italic [font-style:italic]">you.</em>
          </>
        }
        subtitle="AgriNexus stays open because companies, foundations and brands choose to fund it. Three ways to stand with farmers — pick the one that fits."
      >
        <CTARow>
          <CTA href="#tiers">See sponsorship tiers →</CTA>
          <CTA href="#advertise" variant="secondary">Advertise with us</CTA>
        </CTARow>
      </Hero>

      <div id="tiers">
        <SectionHeader
          num="01"
          eyebrow="Sponsorship tiers"
          title={<>Three ways to <em className="grad-text">stand with farmers.</em></>}
          subtitle="Every tier funds farmer access directly. Sponsor presence is visible, trackable, and never influences agent recommendations."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 px-8 pb-12 max-w-3xl mx-auto">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={
              t.featured
                ? "glass relative p-6 flex flex-col bg-gradient-to-b from-forest-700 to-[#143820] text-white border-harvest-500 border md:scale-[1.02]"
                : "glass p-6 flex flex-col"
            }
          >
            {t.featured && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-harvest-500 text-white py-0.5 px-3 rounded-full font-mono text-[9px] font-semibold tracking-[0.08em]">
                MOST CHOSEN
              </span>
            )}
            <div className={t.featured ? "font-serif text-[26px] italic tracking-[-0.01em] mb-1 grad-text" : "font-serif text-[26px] italic tracking-[-0.01em] mb-1 grad-text"}>
              {t.name}
            </div>
            <div className={`text-[11px] italic mb-3.5 ${t.featured ? "text-white/70" : "text-ink/55"}`}>
              {t.forWhom}
            </div>
            <div className="font-serif text-4xl leading-none tracking-[-0.02em] mb-1">{t.price}</div>
            <div className={`text-[11px] mb-4 ${t.featured ? "text-white/70" : "text-ink/55"}`}>{t.unit}</div>
            <ul className="list-none p-0 my-0 mb-4 flex-1 flex flex-col gap-2">
              {t.perks.map((p) => (
                <li
                  key={p}
                  className={`text-[12.5px] leading-[1.4] flex gap-2 items-start ${t.featured ? "text-white/85" : "text-ink/75"}`}
                >
                  <span className={t.featured ? "text-harvest-200 text-[8px] mt-1.5 flex-shrink-0" : "text-forest-500 text-[8px] mt-1.5 flex-shrink-0"}>
                    ●
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className={`pt-3.5 border-t text-[11px] font-medium text-center mb-3.5 ${t.featured ? "text-harvest-200 border-white/15" : "text-forest-700 border-ink/[0.08]"}`}>
              {t.impact}
            </div>
            <button className={`py-2.5 rounded-full text-xs font-medium border-none cursor-pointer ${t.featured ? "bg-harvest-500 text-white" : "bg-ink text-white"}`}>
              {t.cta}
            </button>
          </div>
        ))}
      </div>

      <SectionHeader
        num="02"
        eyebrow="Already on board"
        title={<>Who already <em className="grad-text">stands with us.</em></>}
        subtitle="A growing coalition across agriculture, finance and food security. Your name belongs here next."
      />
      <div className="px-8 pb-12 max-w-3xl mx-auto">
        <div className="glass p-7">
          {wallTiers.map((wt) => (
            <div key={wt.label} className="mb-6 last:mb-0">
              <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-forest-700 mb-3 pb-2 border-b border-ink/[0.06]">
                {wt.label}
              </div>
              <div className="flex flex-wrap gap-x-9 gap-y-6 items-center justify-around">
                {wt.logos.map((l) => (
                  <span key={l} className={`font-serif italic ${wt.size} ${wt.color}`}>{l}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="advertise">
        <SectionHeader
          num="03"
          eyebrow="Native advertising"
          title={<>Reach the farmer <em className="grad-text">at the moment of decision.</em></>}
          subtitle="Targeted by crop, region, season. Always clearly labeled as sponsored. Never affects what the agents recommend."
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3.5 px-8 pb-12 max-w-3xl mx-auto">
        {ads.map((a) => (
          <div key={a.name} className="glass p-5">
            <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-forest-700/10 to-harvest-500/[0.12] flex items-center justify-center text-xl mb-3.5">
              {a.icon}
            </div>
            <div className="text-[15px] font-medium mb-1.5 tracking-[-0.005em]">{a.name}</div>
            <div className="text-[12.5px] text-ink/60 leading-[1.5] mb-3">{a.desc}</div>
            <div className="flex gap-1.5 flex-wrap pt-2.5 border-t border-ink/[0.06]">
              {a.specs.map((s) => (
                <span key={s} className="font-mono text-[10px] py-0.5 px-2 bg-forest-700/[0.06] text-forest-700 rounded tracking-[0.04em]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionHeader eyebrow="// Common questions" title={<>Answered <em className="grad-text">upfront.</em></>} />
      <div className="px-8 pb-12 max-w-2xl mx-auto">
        {faqs.map((f) => (
          <div key={f.q} className="glass p-5 mb-2.5">
            <h3 className="font-serif text-[17px] font-normal tracking-[-0.01em] mb-2">{f.q}</h3>
            <p className="text-[13px] text-ink/65 leading-[1.55] m-0">{f.a}</p>
          </div>
        ))}
      </div>

      <section className="py-12 px-8 max-w-2xl mx-auto text-center">
        <h2 className="font-serif text-3xl font-normal leading-[1.2] tracking-[-0.02em] mb-3">
          Will you be the reason
          <br />
          <em className="grad-text">a farm grows?</em>
        </h2>
        <p className="text-[13px] text-ink/55 mb-5">One conversation. We&apos;ll find the right fit.</p>
        <CTARow>
          <CTA href="mailto:partners@agrinexus.io">Book a 30-min intro call →</CTA>
          <CTA href="#" variant="secondary">Download the brief PDF</CTA>
        </CTARow>
      </section>

    </>
  );
}
