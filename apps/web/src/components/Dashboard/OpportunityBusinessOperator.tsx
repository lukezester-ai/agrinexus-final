"use client";

import { useState } from "react";
import type { BusinessOperatorAdvice } from "@/lib/ai-business-operator";
import type { OpportunityWorkspaceMatch } from "@/lib/business-opportunities";
import { matchPercent, positiveReasonCodes } from "@/lib/business-radar";
import { supabase } from "@/lib/supabase";

const copy = {
	en: { title: "AI Business Operator", lead: "Get a grounded review of this opportunity and a qualified match.", run: "Analyze", working: "Analyzing…", failed: "The operator could not complete this review.", assessment: "Assessment", missing: "Missing data", matches: "Match insights", risks: "Risks", actions: "Recommended actions", draft: "Introduction preview", boundary: "AI recommends and drafts. Authorization and audited commands execute.", choose: "Qualified match", noQualified: "No qualified match is ready for an introduction.", request: "Request introduction", requesting: "Requesting…", confirm: "Send this introduction request through the audited command boundary?", requested: "Introduction requested." },
	bg: { title: "AI бизнес оператор", lead: "Получи обоснован преглед на възможността и конкретно квалифицирано съвпадение.", run: "Анализирай", working: "Анализира се…", failed: "Операторът не успя да завърши анализа.", assessment: "Оценка", missing: "Липсващи данни", matches: "Изводи за съвпадението", risks: "Рискове", actions: "Препоръчани действия", draft: "Преглед на представянето", boundary: "AI предлага и подготвя чернова. Authorization и audited command границите изпълняват.", choose: "Квалифицирано съвпадение", noQualified: "Няма квалифицирано съвпадение, готово за представяне.", request: "Заяви представяне", requesting: "Изпраща се…", confirm: "Да се изпрати ли заявката за представяне през одитираната command граница?", requested: "Заявката за представяне е изпратена." },
} as const;

export function OpportunityBusinessOperator({ opportunityId, locale, matches }: { opportunityId: string; locale: string; matches: OpportunityWorkspaceMatch[] }) {
	const t = locale === "bg" ? copy.bg : copy.en;
	const qualifiedMatches = matches.filter((match) => match.lifecycle === "qualified" && !match.introductionStatus);
	const [matchId, setMatchId] = useState(qualifiedMatches[0]?.id ?? "");
	const [advice, setAdvice] = useState<BusinessOperatorAdvice | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [requesting, setRequesting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function analyze() {
		setLoading(true);
		setError(null);
		const response = await fetch("/api/opportunities/operator", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ opportunityId, locale, matchId: matchId || undefined }),
		});
		const body = (await response.json().catch(() => ({}))) as { advice?: BusinessOperatorAdvice; error?: string };
		setLoading(false);
		if (!response.ok || !body.advice) {
			setError(body.error || t.failed);
			return;
		}
		setAdvice(body.advice);
	}

	async function requestIntroduction() {
		if (!matchId || !advice?.introductionDraft || !window.confirm(t.confirm)) return;
		setRequesting(true);
		setError(null);
		setMessage(null);
		const { error: rpcError } = await supabase.rpc("request_business_match_introduction", {
			p_match_id: matchId,
			p_note: advice.introductionDraft,
		});
		setRequesting(false);
		if (rpcError) {
			setError(rpcError.message);
			return;
		}
		setMessage(t.requested);
	}

	const section = (title: string, items: string[]) =>
		items.length ? <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/70">{items.map((item) => <li key={item}>{item}</li>)}</ul></div> : null;

	return (
		<section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/45 p-5" data-testid="ai-business-operator">
			<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-violet-700">{t.title}</p>
			<p className="mt-2 text-sm leading-relaxed text-ink/60">{t.lead}</p>
			<p className="mt-2 text-xs text-ink/40">{t.boundary}</p>
			{qualifiedMatches.length ? <label className="mt-4 block text-xs font-medium text-ink/60">{t.choose}<select value={matchId} onChange={(event) => { setMatchId(event.target.value); setAdvice(null); setMessage(null); }} className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-ink">{qualifiedMatches.map((match) => <option key={match.id} value={match.id}>{matchPercent(match.score)}% · {positiveReasonCodes(match.reasons).join(", ") || match.id.slice(0, 8)}</option>)}</select></label> : <p className="mt-4 text-sm text-ink/50">{t.noQualified}</p>}
			<button type="button" onClick={() => void analyze()} disabled={loading} className="mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-60">
				{loading ? t.working : t.run}
			</button>
			{error ? <p className="mt-3 text-sm text-red-800" role="alert">{error}</p> : null}
			{message ? <p className="mt-3 text-sm text-forest-700" role="status">{message}</p> : null}
			{advice ? <div className="mt-5 space-y-5 border-t border-violet-200 pt-5"><div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{t.assessment}</h3><p className="mt-2 text-sm leading-relaxed text-ink/75">{advice.assessment}</p></div>{section(t.missing, advice.missingData)}{section(t.matches, advice.matchInsights)}{section(t.risks, advice.risks)}{section(t.actions, advice.nextActions)}{advice.introductionDraft ? <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{t.draft}</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-ink/70">{advice.introductionDraft}</p><button type="button" onClick={() => void requestIntroduction()} disabled={requesting} className="mt-3 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-[13px] font-medium text-violet-800 disabled:opacity-60">{requesting ? t.requesting : t.request}</button></div> : null}</div> : null}
		</section>
	);
}
