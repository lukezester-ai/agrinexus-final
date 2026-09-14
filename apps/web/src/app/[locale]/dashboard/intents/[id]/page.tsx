import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadIntentWorkspace } from "@/lib/intent-workspace";
import { LifecycleActionButton } from "@/components/Dashboard/LifecycleActionButton";
import { matchPercent } from "@/lib/business-radar";

const copy = {
	en: { back: "← Intents", status: "Lifecycle", private: "Private brief", matches: "Matches", activity: "Activity", none: "Nothing here yet.", withdraw: "Withdraw", pause: "Pause", activate: "Activate", fulfill: "Mark fulfilled" },
	bg: { back: "← Намерения", status: "Жизнен цикъл", private: "Поверителен контекст", matches: "Съвпадения", activity: "Развитие", none: "Все още няма данни.", withdraw: "Оттегли", pause: "Пауза", activate: "Активирай", fulfill: "Маркирай изпълнено" },
	ar: { back: "← النيات", status: "دورة الحياة", private: "التفاصيل الخاصة", matches: "المطابقات", activity: "النشاط", none: "لا توجد بيانات بعد.", withdraw: "سحب", pause: "إيقاف مؤقت", activate: "تفعيل", fulfill: "وضع علامة مكتمل" },
} as const;

export default async function IntentWorkspacePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
	const { locale, id } = await params; setRequestLocale(locale);
	const workspace = await loadIntentWorkspace(id); if (!workspace) notFound();
	const t = locale === "bg" ? copy.bg : locale === "ar" ? copy.ar : copy.en;
	const { intent } = workspace;
	const actions = !workspace.canManage ? [] : intent.lifecycle === "draft" ? [["active", t.activate], ["withdrawn", t.withdraw]] : intent.lifecycle === "active" ? [["paused", t.pause], ["fulfilled", t.fulfill], ["withdrawn", t.withdraw]] : intent.lifecycle === "paused" ? [["active", t.activate], ["fulfilled", t.fulfill], ["withdrawn", t.withdraw]] : [];
	return <div className="mx-auto max-w-4xl px-4 py-5 pb-12 md:px-7">
		<Link href="/dashboard/intents" className="text-sm text-forest-700">{t.back}</Link>
		<header className="mt-6 rounded-2xl border border-ink/[0.07] bg-white/70 p-5"><h1 className="font-serif text-3xl text-ink">{intent.headline}</h1><p className="mt-3 text-sm text-ink/65">{intent.public_summary}</p><p className="mt-4 font-mono text-xs uppercase text-ink/45">{intent.kind} · {intent.visibility} · {intent.industry}</p><p className="mt-2 text-sm text-ink/55">{intent.target_markets.join(" · ")}</p></header>
		<section className="mt-5 rounded-2xl border border-harvest-200 bg-harvest-50/50 p-5"><h2 className="text-xs font-semibold uppercase text-harvest-700">{t.status}: {intent.lifecycle}</h2><div className="mt-3 flex flex-wrap gap-2">{actions.map(([target,label]) => <LifecycleActionButton key={target} fn="transition_business_intent_v1" args={{ p_intent_id: intent.id, p_target_lifecycle: target }} label={label} confirmMessage={`${label}?`} />)}</div></section>
		{workspace.privateBrief ? <section className="mt-5 rounded-2xl border border-ink/10 bg-white/60 p-5"><h2 className="text-xs font-semibold uppercase text-ink/45">{t.private}</h2><p className="mt-2 text-sm text-ink/65">{workspace.privateBrief}</p></section> : null}
		<section className="mt-8"><h2 className="font-serif text-2xl">{t.matches}</h2>{workspace.matches.length ? <ul className="mt-3 space-y-2">{workspace.matches.map((m) => <li key={m.id} className="rounded-xl border border-ink/10 bg-white/60 p-4"><span className="capitalize">{m.lifecycle}</span> · {matchPercent(m.score)}%</li>)}</ul> : <p className="mt-2 text-sm text-ink/50">{t.none}</p>}</section>
		<section className="mt-8"><h2 className="font-serif text-2xl">{t.activity}</h2>{workspace.audit.length ? <ol className="mt-3 border-l border-ink/10 pl-5">{workspace.audit.map((e) => <li key={e.id} className="mb-4"><p className="text-sm font-medium">{String(e.action).replaceAll(".", " · ")}</p><time className="text-xs text-ink/40">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.created_at))}</time></li>)}</ol> : <p className="mt-2 text-sm text-ink/50">{t.none}</p>}</section>
	</div>;
}
