"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import {
	INDUSTRY_SUGGESTIONS,
	INTENT_KINDS,
	INTENT_VISIBILITIES,
	parseMarketList,
	type IntentKind,
	type IntentVisibility,
} from "@/lib/business-intents";

const copy = {
	en: {
		kind: "Intent type",
		headline: "Internal headline",
		summary: "Public-safe summary",
		summaryHint: "What a counterparty may see if visibility is network or public. Keep confidential details out.",
		industry: "Industry",
		markets: "Target markets",
		marketsHint: "ISO country codes or regions, comma-separated. Used by matching.",
		visibility: "Visibility",
		expires: "Expiry",
		brief: "Confidential brief",
		briefHint: "Org-only. Matching never reads this as free text for counterparties.",
		draft: "Save draft",
		publish: "Activate",
		saving: "Saving…",
		kinds: {
			buy: "Buy",
			sell: "Sell",
			partner: "Partner",
			invest: "Invest",
			supply: "Supply",
			distribute: "Distribute",
			hire: "Hire",
			seek_capability: "Seek capability",
		},
		vis: {
			private: "Private — org only, not indexed",
			confidential: "Confidential — matchable, identity hidden",
			network: "Network — visible to other orgs",
			public: "Public — listed openly",
		},
	},
	bg: {
		kind: "Тип намерение",
		headline: "Вътрешно заглавие",
		summary: "Публично безопасно резюме",
		summaryHint: "Какво може да види контрагент при network/public. Без поверителни детайли.",
		industry: "Индустрия",
		markets: "Целеви пазари",
		marketsHint: "ISO кодове или региони, разделени със запетая. За matching.",
		visibility: "Видимост",
		expires: "Валидно до",
		brief: "Поверителен бриф",
		briefHint: "Само за организацията. Matching не го показва на другата страна.",
		draft: "Чернова",
		publish: "Активирай",
		saving: "Запис…",
		kinds: {
			buy: "Покупка",
			sell: "Продажба",
			partner: "Партньорство",
			invest: "Инвестиция",
			supply: "Доставка",
			distribute: "Дистрибуция",
			hire: "Наемане",
			seek_capability: "Търсене на способност",
		},
		vis: {
			private: "Лично — само организация, без индекс",
			confidential: "Поверително — matchable, самоличността е скрита",
			network: "Мрежа — видимо за други организации",
			public: "Публично — открит списък",
		},
	},
};

export function IntentCreateForm({
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
	const [kind, setKind] = useState<IntentKind>("partner");
	const [headline, setHeadline] = useState("");
	const [publicSummary, setPublicSummary] = useState("");
	const [industry, setIndustry] = useState("");
	const [markets, setMarkets] = useState("");
	const [visibility, setVisibility] = useState<IntentVisibility>("confidential");
	const [expires, setExpires] = useState("");
	const [brief, setBrief] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function save(lifecycle: "draft" | "active") {
		setSaving(true);
		setError(null);
		const target_markets = parseMarketList(markets);
		const { data: intent, error: insertError } = await supabase
			.from("business_intents")
			.insert({
				organization_id: organizationId,
				created_by: userId,
				kind,
				headline: headline.trim(),
				public_summary: publicSummary.trim(),
				industry: industry.trim(),
				target_markets,
				visibility,
				lifecycle,
				expires_at: expires ? new Date(expires).toISOString() : null,
			})
			.select("id")
			.single();

		if (insertError || !intent?.id) {
			setSaving(false);
			setError(insertError?.message ?? "Save failed");
			return;
		}

		if (brief.trim()) {
			const { error: secretError } = await supabase.from("business_intent_secrets").insert({
				intent_id: intent.id,
				organization_id: organizationId,
				private_brief: brief.trim(),
			});
			if (secretError) {
				setSaving(false);
				setError(secretError.message);
				return;
			}
		}

		router.push("/dashboard/intents");
		router.refresh();
	}

	const field = "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-forest-600";

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
				<select className={field} value={kind} onChange={(e) => setKind(e.target.value as IntentKind)}>
					{INTENT_KINDS.map((k) => (
						<option key={k} value={k}>
							{t.kinds[k]}
						</option>
					))}
				</select>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.headline}
				<input className={field} required value={headline} onChange={(e) => setHeadline(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.summary}
				<textarea className={field} rows={3} value={publicSummary} onChange={(e) => setPublicSummary(e.target.value)} />
				<span className="font-normal text-ink/45">{t.summaryHint}</span>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.industry}
				<input
					className={field}
					required
					list="industry-suggestions"
					value={industry}
					onChange={(e) => setIndustry(e.target.value)}
				/>
				<datalist id="industry-suggestions">
					{INDUSTRY_SUGGESTIONS.map((item) => (
						<option key={item} value={item} />
					))}
				</datalist>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.markets}
				<input className={field} placeholder="BG, RO, DE" value={markets} onChange={(e) => setMarkets(e.target.value)} />
				<span className="font-normal text-ink/45">{t.marketsHint}</span>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.visibility}
				<select
					className={field}
					value={visibility}
					onChange={(e) => setVisibility(e.target.value as IntentVisibility)}
				>
					{INTENT_VISIBILITIES.map((v) => (
						<option key={v} value={v}>
							{t.vis[v]}
						</option>
					))}
				</select>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.expires}
				<input className={field} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.brief}
				<textarea className={field} rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
				<span className="font-normal text-ink/45">{t.briefHint}</span>
			</label>
			{error ? <p className="text-sm text-red-800">{error}</p> : null}
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={saving}
					className="rounded-xl border border-ink/15 bg-white/80 px-4 py-2.5 text-[13px] font-medium text-ink disabled:opacity-50"
				>
					{saving ? t.saving : t.draft}
				</button>
				<button
					type="button"
					disabled={saving}
					onClick={() => void save("active")}
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
				>
					{saving ? t.saving : t.publish}
				</button>
			</div>
		</form>
	);
}
