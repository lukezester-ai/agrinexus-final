"use client";

import { useState } from "react";
import type { BusinessOperatorAdvice } from "@/lib/ai-business-operator";

const copy = {
	en: { title: "AI Business Operator", lead: "Get a grounded review of this opportunity and its current match signals.", run: "Analyze opportunity", working: "Analyzing…", failed: "The operator could not complete this review.", assessment: "Assessment", missing: "Missing data", matches: "Match insights", risks: "Risks", actions: "Recommended actions", draft: "Introduction draft", boundary: "AI recommends and drafts. Existing authorization and command boundaries execute." },
	bg: { title: "AI бизнес оператор", lead: "Получи обоснован преглед на възможността и текущите сигнали за съвпадение.", run: "Анализирай възможността", working: "Анализира се…", failed: "Операторът не успя да завърши анализа.", assessment: "Оценка", missing: "Липсващи данни", matches: "Изводи за съвпаденията", risks: "Рискове", actions: "Препоръчани действия", draft: "Чернова за представяне", boundary: "AI предлага и подготвя чернова. Съществуващите authorization и command граници изпълняват." },
} as const;

export function OpportunityBusinessOperator({ opportunityId, locale }: { opportunityId: string; locale: string }) {
	const t = locale === "bg" ? copy.bg : copy.en;
	const [advice, setAdvice] = useState<BusinessOperatorAdvice | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function analyze() {
		setLoading(true);
		setError(null);
		const response = await fetch("/api/opportunities/operator", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ opportunityId, locale }),
		});
		const body = (await response.json().catch(() => ({}))) as { advice?: BusinessOperatorAdvice; error?: string };
		setLoading(false);
		if (!response.ok || !body.advice) {
			setError(body.error || t.failed);
			return;
		}
		setAdvice(body.advice);
	}

	const section = (title: string, items: string[]) =>
		items.length ? <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/70">{items.map((item) => <li key={item}>{item}</li>)}</ul></div> : null;

	return (
		<section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/45 p-5" data-testid="ai-business-operator">
			<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-violet-700">{t.title}</p>
			<p className="mt-2 text-sm leading-relaxed text-ink/60">{t.lead}</p>
			<p className="mt-2 text-xs text-ink/40">{t.boundary}</p>
			<button type="button" onClick={() => void analyze()} disabled={loading} className="mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-60">
				{loading ? t.working : t.run}
			</button>
			{error ? <p className="mt-3 text-sm text-red-800" role="alert">{error}</p> : null}
			{advice ? <div className="mt-5 space-y-5 border-t border-violet-200 pt-5"><div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{t.assessment}</h3><p className="mt-2 text-sm leading-relaxed text-ink/75">{advice.assessment}</p></div>{section(t.missing, advice.missingData)}{section(t.matches, advice.matchInsights)}{section(t.risks, advice.risks)}{section(t.actions, advice.nextActions)}{advice.introductionDraft ? <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{t.draft}</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-ink/70">{advice.introductionDraft}</p></div> : null}</div> : null}
		</section>
	);
}
