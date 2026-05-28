"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
	BREAK_EVEN_STORAGE_KEY,
	type BreakEvenInputs,
	computeBreakEvenEurPerTonne,
	DEFAULT_BREAK_EVEN_INPUTS,
	formatEur,
	formatEurPerTonne,
	totalCostEurPerHa,
} from "@/lib/break-even";
import { syncLegacyLocalPrice } from "@/lib/local-price";
import { LocalPriceBuyers } from "@/components/break-even/LocalPriceBuyers";

type Props = {
	locale: string;
	userId: string;
	initial: BreakEvenInputs | null;
};

const copy = {
	en: {
		title: "Break-even (your farm)",
		sub: "Enter costs once per hectare — we turn every market price into your margin in €/t and for the whole farm.",
		seeds: "Seeds (€/ha)",
		fertilizer: "Fertilizer (€/ha)",
		fuel: "Fuel & machinery (€/ha)",
		rent: "Rent / land (€/ha)",
		other: "Other (€/ha)",
		yield: "Expected yield (t/ha)",
		previewBreakEven: "Your break-even",
		previewPerHa: "Total cost / ha",
		save: "Save break-even",
		saving: "Saving…",
		saved: "Saved.",
		err: "Could not save. If you manage Supabase, run apps/backend/rag/farm_profiles_break_even.sql",
	},
	bg: {
		title: "Себестойност (твоето стопанство)",
		sub: "Въведи разходите веднъж на хектар — всяка пазарна цена става твоя маржа в €/т и за цялото стопанство.",
		seeds: "Семена (€/ha)",
		fertilizer: "Торове (€/ha)",
		fuel: "Гориво и техника (€/ha)",
		rent: "Аренда / земя (€/ha)",
		other: "Други (€/ha)",
		yield: "Очакван добив (t/ha)",
		previewBreakEven: "Твоя себестойност",
		previewPerHa: "Общ разход / ha",
		save: "Запази себестойност",
		saving: "Запазване…",
		saved: "Запазено.",
		err: "Неуспешно запазване. В Supabase пусни apps/backend/rag/farm_profiles_break_even.sql",
	},
};

function loadInitial(initial: BreakEvenInputs | null): BreakEvenInputs {
	if (initial) return initial;
	if (typeof window === "undefined") return { ...DEFAULT_BREAK_EVEN_INPUTS };
	try {
		const raw = localStorage.getItem(BREAK_EVEN_STORAGE_KEY);
		if (raw) return { ...DEFAULT_BREAK_EVEN_INPUTS, ...JSON.parse(raw) };
	} catch {
		/* ignore */
	}
	return { ...DEFAULT_BREAK_EVEN_INPUTS };
}

export function BreakEvenSettings({ locale, userId, initial }: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const [inputs, setInputs] = useState<BreakEvenInputs>(() => loadInitial(initial));
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<"ok" | "err" | null>(null);

	const breakEven = useMemo(() => computeBreakEvenEurPerTonne(inputs), [inputs]);
	const perHa = useMemo(() => totalCostEurPerHa(inputs), [inputs]);

	const setNum = (key: CostFieldKey | "yield_t_per_ha", value: string) => {
		const n = value === "" ? 0 : parseFloat(value);
		setInputs((prev) => ({ ...prev, [key]: Number.isNaN(n) ? 0 : n }));
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMsg(null);
		const payload = syncLegacyLocalPrice({ ...inputs });

		const { error } = await supabase
			.from("farm_profiles")
			.update({ break_even_inputs: payload })
			.eq("user_id", userId);

		if (error) {
			try {
				localStorage.setItem(BREAK_EVEN_STORAGE_KEY, JSON.stringify(payload));
				setMsg("ok");
			} catch {
				setMsg("err");
			}
		} else {
			localStorage.setItem(BREAK_EVEN_STORAGE_KEY, JSON.stringify(payload));
			setMsg("ok");
		}
		setLoading(false);
	};

	type CostFieldKey =
		| "cost_seeds_eur_per_ha"
		| "cost_fertilizer_eur_per_ha"
		| "cost_fuel_eur_per_ha"
		| "cost_rent_eur_per_ha"
		| "cost_other_eur_per_ha";

	const fields: { key: CostFieldKey; label: string }[] = [
		{ key: "cost_seeds_eur_per_ha", label: c.seeds },
		{ key: "cost_fertilizer_eur_per_ha", label: c.fertilizer },
		{ key: "cost_fuel_eur_per_ha", label: c.fuel },
		{ key: "cost_rent_eur_per_ha", label: c.rent },
		{ key: "cost_other_eur_per_ha", label: c.other },
	];

	return (
		<section className="mt-8 border-t border-ink/10 pt-8">
			<h2 className="font-serif text-lg font-medium tracking-tight text-ink">{c.title}</h2>
			<p className="mt-1 text-xs leading-relaxed text-ink/55">{c.sub}</p>

			<form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{fields.map(({ key, label }) => (
						<div key={key} className="flex flex-col gap-1.5">
							<label className="text-xs font-medium text-ink/70">{label}</label>
							<input
								type="number"
								min={0}
								step={1}
								value={inputs[key] === 0 ? "" : inputs[key]}
								onChange={(e) => setNum(key, e.target.value)}
								className="rounded-xl border border-ink/10 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-forest-500 focus:bg-white"
							/>
						</div>
					))}
				</div>

				<div className="flex flex-col gap-1.5 max-w-xs">
					<label className="text-xs font-medium text-ink/70">{c.yield}</label>
					<input
						type="number"
						min={0.1}
						step={0.1}
						value={inputs.yield_t_per_ha}
						onChange={(e) => setNum("yield_t_per_ha", e.target.value)}
						className="rounded-xl border border-ink/10 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-forest-500 focus:bg-white"
					/>
				</div>

				<LocalPriceBuyers
					locale={locale}
					inputs={inputs}
					onChange={(next) => setInputs(next)}
				/>

				{breakEven != null ? (
					<div className="rounded-xl border border-forest-700/15 bg-forest-700/[0.06] px-4 py-3 text-sm">
						<div className="flex flex-wrap justify-between gap-2">
							<span className="text-ink/60">{c.previewPerHa}</span>
							<span className="font-mono font-medium text-ink">{formatEur(perHa, locale)}/ha</span>
						</div>
						<div className="mt-2 flex flex-wrap justify-between gap-2">
							<span className="text-ink/60">{c.previewBreakEven}</span>
							<span className="font-serif text-xl text-forest-700">{formatEurPerTonne(breakEven, locale)}</span>
						</div>
					</div>
				) : null}

				<button
					type="submit"
					disabled={loading || breakEven == null}
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
				>
					{loading ? c.saving : c.save}
				</button>
				{msg === "ok" ? <p className="text-xs text-forest-700">{c.saved}</p> : null}
				{msg === "err" ? <p className="text-xs text-semantic-alert">{c.err}</p> : null}
			</form>
		</section>
	);
}
