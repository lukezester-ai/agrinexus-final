"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { parseMarketList } from "@/lib/business-intents";
import {
	OPPORTUNITY_KINDS,
	OPPORTUNITY_VISIBILITIES,
	type OpportunityKind,
	type OpportunityVisibility,
} from "@/lib/business-opportunities";

const copy = {
	en: {
		kind: "Opportunity type",
		title: "Internal title",
		summary: "Public-safe summary",
		industry: "Industry",
		markets: "Target markets",
		visibility: "Visibility",
		draft: "Save draft",
		publish: "Open",
		saving: "Saving…",
	},
	bg: {
		kind: "Тип възможност",
		title: "Вътрешно заглавие",
		summary: "Публично безопасно резюме",
		industry: "Индустрия",
		markets: "Целеви пазари",
		visibility: "Видимост",
		draft: "Чернова",
		publish: "Отвори",
		saving: "Запис…",
	},
};

export function OpportunityCreateForm({
	locale,
	organizationId,
	userId,
}: {
	locale: string;
	organizationId: string;
	userId: string;
}) {
	const router = useRouter();
	const t = locale === "bg" ? copy.bg : copy.en;
	const [kind, setKind] = useState<OpportunityKind>("sell");
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [industry, setIndustry] = useState("");
	const [markets, setMarkets] = useState("");
	const [visibility, setVisibility] = useState<OpportunityVisibility>("confidential");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function save(lifecycle: "draft" | "open") {
		setSaving(true);
		setError(null);
		const { error: insertError } = await supabase.from("business_opportunities").insert({
			organization_id: organizationId,
			created_by: userId,
			source_type: "manual",
			source_ref: "ui",
			title: title.trim(),
			summary: summary.trim(),
			industry: industry.trim(),
			target_markets: parseMarketList(markets),
			visibility,
			lifecycle,
			facets: { kind },
			provenance: {},
		});
		if (insertError) {
			setSaving(false);
			setError(insertError.message);
			return;
		}
		router.push("/dashboard/opportunities");
		router.refresh();
	}

	const field = "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm";
	return (
		<form
			className="flex max-w-xl flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				void save("draft");
			}}
		>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.kind}
				<select className={field} value={kind} onChange={(e) => setKind(e.target.value as OpportunityKind)}>
					{OPPORTUNITY_KINDS.map((k) => (
						<option key={k} value={k}>
							{k}
						</option>
					))}
				</select>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.title}
				<input className={field} required value={title} onChange={(e) => setTitle(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.summary}
				<textarea className={field} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.industry}
				<input className={field} required value={industry} onChange={(e) => setIndustry(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.markets}
				<input className={field} value={markets} onChange={(e) => setMarkets(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.visibility}
				<select
					className={field}
					value={visibility}
					onChange={(e) => setVisibility(e.target.value as OpportunityVisibility)}
				>
					{OPPORTUNITY_VISIBILITIES.map((v) => (
						<option key={v} value={v}>
							{v}
						</option>
					))}
				</select>
			</label>
			{error ? <p className="text-sm text-red-800">{error}</p> : null}
			<div className="flex gap-2">
				<button type="submit" disabled={saving} className="rounded-xl border border-ink/15 px-4 py-2.5 text-[13px]">
					{saving ? t.saving : t.draft}
				</button>
				<button
					type="button"
					disabled={saving}
					onClick={() => void save("open")}
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] text-white"
				>
					{saving ? t.saving : t.publish}
				</button>
			</div>
		</form>
	);
}
