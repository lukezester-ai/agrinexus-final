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
import type { IntentSuggestion } from "@/lib/ai-intent-assist";

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
		assistTitle: "Draft with AI",
		assistHint: "Describe the business need. Do not include confidential information. Nothing is saved automatically.",
		assistPlaceholder: "We need a logistics partner for temperature-controlled deliveries in Germany and Romania…",
		assistGenerate: "Generate suggestion",
		assistGenerating: "Generating…",
		assistApply: "Apply suggestion",
		assistPreview: "Review before applying",
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
		assistTitle: "Чернова с AI",
		assistHint: "Опишете бизнес нуждата. Не включвайте поверителна информация. Нищо не се записва автоматично.",
		assistPlaceholder: "Търсим логистичен партньор за температурно контролирани доставки в Германия и Румъния…",
		assistGenerate: "Създай предложение",
		assistGenerating: "Генериране…",
		assistApply: "Приложи предложението",
		assistPreview: "Преглед преди прилагане",
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
	const [assistText, setAssistText] = useState("");
	const [assisting, setAssisting] = useState(false);
	const [suggestion, setSuggestion] = useState<IntentSuggestion | null>(null);

	async function generateSuggestion() {
		setAssisting(true);
		setSuggestion(null);
		setError(null);
		try {
			const response = await fetch("/api/intents/assist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organizationId, sourceText: assistText, locale }),
			});
			const data = await response.json() as { suggestion?: IntentSuggestion; error?: string };
			if (!response.ok || !data.suggestion) {
				setError(data.error || "intent_assistant_failed");
				return;
			}
			setSuggestion(data.suggestion);
		} catch {
			setError("intent_assistant_unavailable");
		} finally {
			setAssisting(false);
		}
	}

	function applySuggestion() {
		if (!suggestion) return;
		setKind(suggestion.kind);
		setHeadline(suggestion.headline);
		setPublicSummary(suggestion.publicSummary);
		setIndustry(suggestion.industry);
		setMarkets(suggestion.targetMarkets.join(", "));
		setSuggestion(null);
	}

	async function save(lifecycle: "draft" | "active") {
		setSaving(true);
		setError(null);
		const target_markets = parseMarketList(markets);
		const { error: commandError } = await supabase.rpc("create_business_intent_v1", {
			p_organization_id: organizationId,
			p_kind: kind,
			p_headline: headline.trim(),
			p_public_summary: publicSummary.trim(),
			p_industry: industry.trim(),
			p_target_markets: target_markets,
			p_visibility: visibility,
			p_initial_lifecycle: lifecycle,
			p_expires_at: expires ? new Date(expires).toISOString() : null,
			p_private_brief: brief.trim() || null,
		});

		if (commandError) {
			setSaving(false);
			setError(commandError.message);
			return;
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
			<section className="rounded-2xl border border-forest-700/15 bg-forest-50/60 p-4">
				<h2 className="text-sm font-semibold text-ink">{t.assistTitle}</h2>
				<p className="mt-1 text-xs text-ink/55">{t.assistHint}</p>
				<textarea
					className={`${field} mt-3`}
					rows={3}
					minLength={20}
					maxLength={4000}
					placeholder={t.assistPlaceholder}
					value={assistText}
					onChange={(e) => setAssistText(e.target.value)}
				/>
				<button
					type="button"
					disabled={assisting || assistText.trim().length < 20}
					onClick={() => void generateSuggestion()}
					className="mt-3 rounded-xl border border-forest-700/25 bg-white px-3 py-2 text-xs font-medium text-forest-800 disabled:opacity-50"
				>
					{assisting ? t.assistGenerating : t.assistGenerate}
				</button>
				{suggestion ? (
					<div className="mt-3 rounded-xl border border-ink/10 bg-white/90 p-3 text-xs text-ink/70">
						<p className="font-semibold text-ink">{t.assistPreview}</p>
						<p className="mt-2"><strong>{suggestion.headline}</strong></p>
						<p className="mt-1">{suggestion.publicSummary}</p>
						<p className="mt-2 text-ink/50">{suggestion.kind} · {suggestion.industry} · {suggestion.targetMarkets.join(", ") || "—"}</p>
						<button type="button" onClick={applySuggestion} className="mt-3 rounded-lg bg-forest-700 px-3 py-2 font-medium text-white">
							{t.assistApply}
						</button>
					</div>
				) : null}
			</section>
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
