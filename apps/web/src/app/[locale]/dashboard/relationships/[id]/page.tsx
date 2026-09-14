import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RelationshipActions } from "@/components/Dashboard/RelationshipActions";
import { loadRelationshipWorkspace } from "@/lib/relationship-workspace";

type PageProps = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { title: "Relationship workspace" };

const labels = {
	en: {
		back: "← Business Radar",
		title: "Relationship workspace",
		lead: "The shared place for the relationship, its state, and the next useful action.",
		parties: "Connected organizations",
		next: "What can I do now?",
		activity: "Relationship history",
		noActivity: "No relationship activity yet.",
		closed: "This relationship is closed. Its audited history remains available.",
		active: "Record an interaction, pause the work, or close the relationship.",
		paused: "Resume the relationship when both sides are ready, or close it.",
	},
	bg: {
		back: "← Business Radar",
		title: "Работно място на връзката",
		lead: "Общото място за бизнес връзката, нейния статус и следващото полезно действие.",
		parties: "Свързани организации",
		next: "Какво мога да направя сега?",
		activity: "История на връзката",
		noActivity: "Все още няма активност по връзката.",
		closed: "Връзката е затворена. Одитираната ѝ история остава налична.",
		active: "Запишете взаимодействие, поставете работата на пауза или затворете връзката.",
		paused: "Възобновете връзката, когато двете страни са готови, или я затворете.",
	},
} as const;

const eventLabels = {
	en: { opened: "Relationship created", reintroduced: "Organizations connected again", touched: "Interaction recorded", paused: "Relationship paused", resumed: "Relationship resumed", closed: "Relationship closed" },
	bg: { opened: "Бизнес връзката е създадена", reintroduced: "Организациите са свързани отново", touched: "Взаимодействието е записано", paused: "Връзката е поставена на пауза", resumed: "Връзката е възобновена", closed: "Връзката е затворена" },
} as const;

export default async function RelationshipWorkspacePage({ params }: PageProps) {
	const { locale, id } = await params;
	setRequestLocale(locale);
	const workspace = await loadRelationshipWorkspace(id);
	if (!workspace) notFound();
	const t = locale === "bg" ? labels.bg : labels.en;
	const events = locale === "bg" ? eventLabels.bg : eventLabels.en;
	const next = workspace.status === "closed" ? t.closed : workspace.status === "paused" ? t.paused : t.active;

	return (
		<div className="mx-auto max-w-3xl px-4 py-5 pb-12 md:px-7">
			<Link href="/dashboard" className="text-sm text-forest-700 no-underline hover:underline">{t.back}</Link>
			<header className="mt-6 rounded-2xl border border-forest-200 bg-forest-50/40 p-5">
				<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest-700">{t.title}</p>
				<h1 className="mt-2 font-serif text-3xl text-ink">{workspace.organizationAName} · {workspace.organizationBName}</h1>
				<p className="mt-3 text-sm leading-relaxed text-ink/65">{t.lead}</p>
				<p className="mt-4 font-mono text-[11px] uppercase text-ink/45">{workspace.status} · {workspace.kind}</p>
			</header>

			<section className="mt-5 rounded-2xl border border-ink/[0.07] bg-white/70 p-5">
				<h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{t.parties}</h2>
				<p className="mt-2 text-base font-medium text-ink">{workspace.organizationAName}</p>
				<p className="mt-1 text-base font-medium text-ink">{workspace.organizationBName}</p>
			</section>

			<section className="mt-5 rounded-2xl border border-harvest-200 bg-harvest-50/60 p-5">
				<h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-harvest-700">{t.next}</h2>
				<p className="mt-2 text-base font-medium text-ink">{next}</p>
				{workspace.canManage ? <RelationshipActions relationshipId={workspace.id} status={workspace.status} locale={locale} /> : null}
			</section>

			<section className="mt-8">
				<h2 className="font-serif text-2xl text-ink">{t.activity}</h2>
				{workspace.events.length ? (
					<ol className="mt-4 border-l border-ink/10 pl-5">
						{workspace.events.map((event) => (
							<li key={event.id} className="mb-4">
								<p className="text-sm font-medium text-ink">{events[event.kind as keyof typeof events] ?? event.kind.replaceAll("_", " ")}</p>
								<time className="mt-1 block text-[11px] text-ink/35">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</time>
							</li>
						))}
					</ol>
				) : <p className="mt-3 text-sm text-ink/50">{t.noActivity}</p>}
			</section>
		</div>
	);
}
