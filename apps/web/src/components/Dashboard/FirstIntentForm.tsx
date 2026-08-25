"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import {
	INDUSTRY_SUGGESTIONS,
	parseMarketList,
} from "@/lib/business-intents";
import { onboardingCopy, productLocale } from "@/lib/product-ux-copy";
import { alertError, fieldControl, primaryAction } from "@/components/Dashboard/journey-ui";

const KINDS = ["buy", "sell", "partner"] as const;
const VISIBILITIES = ["confidential", "network", "public"] as const;

export function FirstIntentForm({
	organizationId,
	userId,
	locale,
}: {
	organizationId: string;
	userId: string;
	locale: string;
}) {
	const c = onboardingCopy[productLocale(locale)];
	const router = useRouter();
	const [kind, setKind] = useState<(typeof KINDS)[number]>("buy");
	const [industry, setIndustry] = useState("");
	const [markets, setMarkets] = useState("");
	const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>("confidential");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function activate() {
		setSaving(true);
		setError(null);
		const text = description.trim();
		const industryValue = industry.trim();
		const target_markets = parseMarketList(markets);
		if (!text || !industryValue || target_markets.length === 0) {
			setSaving(false);
			setError(c.requiredError);
			return;
		}

		const { error: insertError } = await supabase.from("business_intents").insert({
			organization_id: organizationId,
			created_by: userId,
			kind,
			headline: text,
			public_summary: text,
			industry: industryValue,
			target_markets,
			visibility,
			lifecycle: "active",
		});

		if (insertError) {
			setSaving(false);
			setError(insertError.message);
			return;
		}

		router.push("/dashboard");
		router.refresh();
	}

	return (
		<form
			className="flex max-w-xl flex-col gap-6"
			data-testid="first-intent-form"
			onSubmit={(e) => {
				e.preventDefault();
				void activate();
			}}
		>
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-1 text-[13px] font-semibold text-ink">{c.kindLegend}</legend>
				{KINDS.map((value) => (
					<label
						key={value}
						className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 ${
							kind === value
								? "border-forest-600 bg-white shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
								: "border-ink/10 bg-white/70"
						}`}
					>
						<span className="flex items-center gap-2.5 text-[15px] font-medium text-ink">
							<input
								type="radio"
								name="kind"
								value={value}
								checked={kind === value}
								onChange={() => setKind(value)}
								className="size-4 accent-forest-700"
							/>
							{c.kinds[value].label}
						</span>
						<span className="ps-7 pt-1 text-[13px] leading-snug text-ink/50">{c.kinds[value].hint}</span>
					</label>
				))}
			</fieldset>

			<label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
				{c.industry}
				<input
					className={fieldControl}
					required
					list="onboarding-industry"
					value={industry}
					onChange={(e) => setIndustry(e.target.value)}
					placeholder={c.industryPlaceholder}
				/>
				<datalist id="onboarding-industry">
					{INDUSTRY_SUGGESTIONS.map((item) => (
						<option key={item} value={item} />
					))}
				</datalist>
			</label>

			<label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
				{c.markets}
				<input
					className={fieldControl}
					required
					value={markets}
					onChange={(e) => setMarkets(e.target.value)}
					placeholder={c.marketsPlaceholder}
				/>
				<span className="font-normal text-[13px] leading-snug text-ink/45">{c.marketsHint}</span>
			</label>

			<label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
				{c.visibility}
				<select
					className={fieldControl}
					value={visibility}
					onChange={(e) => setVisibility(e.target.value as (typeof VISIBILITIES)[number])}
				>
					{VISIBILITIES.map((value) => (
						<option key={value} value={value}>
							{c.visibilities[value]}
						</option>
					))}
				</select>
			</label>

			<label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
				{c.description}
				<textarea
					className={fieldControl}
					required
					rows={4}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder={c.descriptionPlaceholder}
				/>
				<span className="font-normal text-[13px] leading-snug text-ink/45">{c.descriptionHint}</span>
			</label>

			{error ? (
				<p className={alertError} role="alert">
					{error}
				</p>
			) : null}

			<button type="submit" disabled={saving} className={`${primaryAction} w-full sm:w-auto`}>
				{saving ? c.activating : c.activate}
			</button>
		</form>
	);
}
