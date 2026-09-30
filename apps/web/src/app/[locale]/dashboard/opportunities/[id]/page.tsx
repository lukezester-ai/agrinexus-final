import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadOpportunityWorkspace } from "@/lib/opportunity-workspace";
import { matchPercent, positiveReasonCodes } from "@/lib/business-radar";
import { OpportunityBusinessOperator } from "@/components/Dashboard/OpportunityBusinessOperator";

type PageProps = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { title: "Opportunity workspace" };

const labels = {
	en: { back: "← Opportunities", overview: "What is happening?", meaning: "What does it mean?", next: "What can I do now?", matches: "Matches", activity: "Activity", private: "Private brief", missing: "Improve this opportunity", noMatches: "No matches are available yet.", noActivity: "No activity yet.", trust: "Eligible under the current trust policy" },
	bg: { back: "← Възможности", overview: "Какво се случва?", meaning: "Какво означава?", next: "Какво мога да направя сега?", matches: "Съвпадения", activity: "Развитие", private: "Поверителен контекст", missing: "Подобри възможността", noMatches: "Все още няма налични съвпадения.", noActivity: "Все още няма развитие.", trust: "Допустимо според текущата trust политика" },
} as const;

const eventLabels = {
	en: { "opportunity.created": "Opportunity created", "opportunity.status_changed": "Opportunity status changed", match_created: "Match found", lifecycle_changed: "Match status changed", introduction_requested: "Introduction requested", introduction_accepted: "Introduction accepted", introduction_declined: "Introduction declined", opened: "Relationship created", reintroduced: "Relationship renewed" },
	bg: { "opportunity.created": "Възможността е създадена", "opportunity.status_changed": "Статусът на възможността е променен", match_created: "Открито е съвпадение", lifecycle_changed: "Статусът на съвпадението е променен", introduction_requested: "Заявено е представяне", introduction_accepted: "Представянето е прието", introduction_declined: "Представянето е отказано", opened: "Създадена е бизнес връзка", reintroduced: "Бизнес връзката е подновена" },
} as const;

export default async function OpportunityWorkspacePage({ params }: PageProps) {
	const { locale, id } = await params;
	setRequestLocale(locale);
	const workspace = await loadOpportunityWorkspace(id);
	if (!workspace) notFound();
	const t = locale === "bg" ? labels.bg : labels.en;
	const events = locale === "bg" ? eventLabels.bg : eventLabels.en;
	const { opportunity } = workspace;
	return (
		<div className="mx-auto max-w-4xl px-4 py-5 pb-12 md:px-7">
			<Link href="/dashboard/opportunities" className="text-sm text-[#8fbf9a] no-underline hover:underline">{t.back}</Link>
			<header className="mt-6 border border-white/15 p-5">
				<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{t.overview}</p>
				<h1 className="mt-2 font-light text-3xl text-white">{opportunity.title}</h1>
				<p className="mt-3 text-sm leading-relaxed text-white/65">{opportunity.summary || "—"}</p>
				<p className="mt-4 font-mono text-[11px] uppercase text-white/45">{opportunity.lifecycle} · {opportunity.visibility} · {opportunity.industry}</p>
				{opportunity.target_markets.length ? <p className="mt-2 text-sm text-white/55">{opportunity.target_markets.join(" · ")}</p> : null}
			</header>

			<section className="mt-5 border border-[#e2b657]/40 p-5">
				<h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-harvest-700">{t.next}</h2>
				<p className="mt-2 text-base font-medium text-white">{workspace.nextAction}</p>
				{workspace.recommendations.length ? <div className="mt-4"><p className="text-sm font-medium text-white">{t.missing}</p><ul className="mt-2 list-disc pl-5 text-sm text-white/65">{workspace.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
			</section>
			{workspace.isOwnerOrganization ? <OpportunityBusinessOperator opportunityId={opportunity.id} locale={locale} matches={workspace.matches} /> : null}

			{workspace.privateBrief ? <section className="mt-5 border border-white/15 p-5"><h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{t.private}</h2><p className="mt-2 text-sm text-white/65">{workspace.privateBrief}</p></section> : null}

			<section className="mt-8">
				<h2 className="font-light text-2xl text-white">{t.meaning} · {t.matches}</h2>
				{workspace.matches.length ? <ul className="mt-4 flex flex-col gap-3">{workspace.matches.map((match) => <li key={match.id} className="border border-white/15 p-5"><div className="flex items-baseline justify-between gap-4"><p className="font-medium capitalize text-white">{match.lifecycle}</p><p className="font-mono text-sm text-white/60">{matchPercent(match.score)}%</p></div><p className="mt-2 text-xs text-[#8fbf9a]">{t.trust}</p>{positiveReasonCodes(match.reasons).length ? <ul className="mt-3 flex flex-wrap gap-2">{positiveReasonCodes(match.reasons).map((reason) => <li key={reason} className="rounded-full bg-ink/[0.05] px-3 py-1 text-xs text-white/60">{reason.replaceAll("_", " ")}</li>)}</ul> : null}{match.introductionStatus ? <p className="mt-3 text-sm text-white/55">Introduction: {match.introductionStatus}</p> : null}{match.relationshipStatus && match.relationshipId ? <p className="mt-1 text-sm text-white/55">Relationship: <Link href={`/dashboard/relationships/${match.relationshipId}`} className="text-[#8fbf9a] hover:underline">{match.relationshipStatus}</Link></p> : null}</li>)}</ul> : <p className="mt-3 text-sm text-white/50">{t.noMatches}</p>}
			</section>

			<section className="mt-8">
				<h2 className="font-light text-2xl text-white">{t.activity}</h2>
				{workspace.timeline.length ? <ol className="mt-4 border-l border-ink/10 pl-5">{workspace.timeline.map((event) => <li key={event.id} className="mb-4"><p className="text-sm font-medium text-white">{events[event.kind as keyof typeof events] ?? event.kind.replaceAll("_", " ").replaceAll(".", " · ")}</p>{event.detail ? <p className="mt-1 text-xs text-white/55">{event.detail}</p> : null}<time className="mt-1 block text-[11px] text-white/35">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</time></li>)}</ol> : <p className="mt-3 text-sm text-white/50">{t.noActivity}</p>}
			</section>
		</div>
	);
}
