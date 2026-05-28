"use client";

import { useEffect, useMemo, useState } from "react";
import type { BreakEvenInputs } from "@/lib/break-even";
import {
	BGN_PER_EUR,
	computeBasisEurPerTonne,
	eurToBgn,
	formatBasisEur,
	formatBgn,
	newBuyerId,
	quoteToEurPerTonne,
	type LocalBuyerQuote,
	type PriceCurrency,
} from "@/lib/local-price";
import { formatEur } from "@/lib/break-even";

type Props = {
	locale: string;
	inputs: BreakEvenInputs;
	onChange: (next: BreakEvenInputs) => void;
};

const copy = {
	en: {
		title: "Local buyers & basis",
		sub: "Track elevator or co-op quotes in €/t or лв/t. We compare to CBOT reference and show basis (local − futures).",
		name: "Buyer name",
		price: "Price / t",
		currency: "Currency",
		date: "Quote date (optional)",
		primary: "Use for margin",
		add: "Add buyer",
		presetElevator: "+ Elevator",
		presetCoop: "+ Co-op",
		eurEquiv: "≈ in EUR",
		bgnEquiv: "≈ in BGN",
		basis: "Basis vs CBOT",
		basisHint: "Negative basis = local price below futures reference.",
		cbotRef: "CBOT ref",
		noCbot: "CBOT reference loading…",
		peg: `BGN peg: 1 € = ${BGN_PER_EUR.toFixed(5)} лв (fixed rate, informational).`,
	},
	bg: {
		title: "Местни купувачи и basis",
		sub: "Следи оферти от елеватор/кооперация в €/t или лв/t. Сравняваме с CBOT референция и показваме basis (местна − фючърс).",
		name: "Име на купувач",
		price: "Цена / t",
		currency: "Валута",
		date: "Дата на оферта (по избор)",
		primary: "За маржа",
		add: "Добави купувач",
		presetElevator: "+ Елеватор",
		presetCoop: "+ Кооперация",
		eurEquiv: "≈ в EUR",
		bgnEquiv: "≈ в BGN",
		basis: "Basis спрямо CBOT",
		basisHint: "Отрицателен basis = местната цена под фючърс референцията.",
		cbotRef: "CBOT ref",
		noCbot: "Зареждане на CBOT…",
		peg: `Курс: 1 € = ${BGN_PER_EUR.toFixed(5)} лв (фиксиран, само информация).`,
	},
};

const PRESETS = {
	elevator: { en: "Elevator", bg: "Елеватор" },
	coop: { en: "Co-op", bg: "Кооперация" },
};

export function LocalPriceBuyers({ locale, inputs, onChange }: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const [cbotEur, setCbotEur] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/market/wheat-ref")
			.then((r) => (r.ok ? r.json() : null))
			.then((data: { cbotEurPerTonne?: number | null } | null) => {
				if (!cancelled && data?.cbotEurPerTonne) setCbotEur(data.cbotEurPerTonne);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	const buyers = useMemo(() => inputs.local_buyers ?? [], [inputs.local_buyers]);
	const primaryId = inputs.primary_buyer_id ?? buyers[0]?.id;

	const updateBuyers = (next: LocalBuyerQuote[]) => {
		const primary =
			next.find((b) => b.id === primaryId) ?? next[0] ?? null;
		onChange({
			...inputs,
			local_buyers: next,
			primary_buyer_id: primary?.id,
		});
	};

	const addBuyer = (name?: string) => {
		const id = newBuyerId();
		const row: LocalBuyerQuote = {
			id,
			name: name ?? "",
			price: 0,
			currency: locale === "bg" ? "BGN" : "EUR",
		};
		const next = [...buyers, row];
		onChange({
			...inputs,
			local_buyers: next,
			primary_buyer_id: primaryId ?? id,
		});
	};

	const patchBuyer = (id: string, patch: Partial<LocalBuyerQuote>) => {
		updateBuyers(buyers.map((b) => (b.id === id ? { ...b, ...patch } : b)));
	};

	const removeBuyer = (id: string) => {
		const next = buyers.filter((b) => b.id !== id);
		onChange({
			...inputs,
			local_buyers: next.length ? next : undefined,
			primary_buyer_id:
				primaryId === id ? next[0]?.id : primaryId,
		});
	};

	const rowsWithBasis = useMemo(() => {
		return buyers.map((b) => {
			const eur = quoteToEurPerTonne(b.price, b.currency);
			const basis =
				b.price > 0 && cbotEur != null ? computeBasisEurPerTonne(eur, cbotEur) : null;
			return { buyer: b, eur, basis };
		});
	}, [buyers, cbotEur]);

	return (
		<div className="mt-6 rounded-xl border border-ink/10 bg-white/40 p-4">
			<h3 className="text-sm font-medium text-ink">{c.title}</h3>
			<p className="mt-1 text-[11px] leading-relaxed text-ink/50">{c.sub}</p>
			<p className="mt-1 text-[10px] text-ink/40">{c.peg}</p>

			{cbotEur != null ? (
				<p className="mt-2 text-[11px] text-ink/55">
					{c.cbotRef}: <span className="font-mono">{formatEur(cbotEur, locale)}/t</span>
				</p>
			) : (
				<p className="mt-2 text-[11px] text-ink/40">{c.noCbot}</p>
			)}

			<div className="mt-4 flex flex-col gap-4">
				{rowsWithBasis.map(({ buyer, eur, basis }) => (
					<div
						key={buyer.id}
						className="rounded-lg border border-ink/8 bg-white/70 p-3 space-y-3"
					>
						<div className="flex flex-wrap items-center gap-2">
							<label className="flex items-center gap-1.5 text-[11px] text-ink/60">
								<input
									type="radio"
									name="primary_buyer"
									checked={primaryId === buyer.id}
									onChange={() =>
										onChange({ ...inputs, primary_buyer_id: buyer.id })
									}
								/>
								{c.primary}
							</label>
							<button
								type="button"
								onClick={() => removeBuyer(buyer.id)}
								className="ml-auto text-[11px] text-semantic-alert hover:underline"
							>
								×
							</button>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div className="flex flex-col gap-1">
								<label className="text-[10px] font-medium text-ink/60">{c.name}</label>
								<input
									type="text"
									value={buyer.name}
									onChange={(e) => patchBuyer(buyer.id, { name: e.target.value })}
									className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-[10px] font-medium text-ink/60">{c.price}</label>
								<input
									type="number"
									min={0}
									step={1}
									value={buyer.price || ""}
									onChange={(e) =>
										patchBuyer(buyer.id, {
											price: parseFloat(e.target.value) || 0,
										})
									}
									placeholder={buyer.currency === "BGN" ? "480" : "246"}
									className="rounded-lg border border-ink/10 px-3 py-2 text-sm font-mono"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-[10px] font-medium text-ink/60">{c.currency}</label>
								<select
									value={buyer.currency}
									onChange={(e) =>
										patchBuyer(buyer.id, {
											currency: e.target.value as PriceCurrency,
										})
									}
									className="rounded-lg border border-ink/10 px-3 py-2 text-sm bg-white"
								>
									<option value="EUR">EUR / t</option>
									<option value="BGN">BGN (лв) / t</option>
								</select>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-[10px] font-medium text-ink/60">{c.date}</label>
								<input
									type="date"
									value={buyer.quoted_at ?? ""}
									onChange={(e) =>
										patchBuyer(buyer.id, {
											quoted_at: e.target.value || undefined,
										})
									}
									className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
								/>
							</div>
						</div>

						{buyer.price > 0 ? (
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/55">
								<span>
									{c.eurEquiv}:{" "}
									<span className="font-mono text-ink">{formatEur(eur, locale)}/t</span>
								</span>
								<span>
									{c.bgnEquiv}:{" "}
									<span className="font-mono text-ink">
										{formatBgn(eurToBgn(eur), locale)}/t
									</span>
								</span>
								{basis != null ? (
									<span>
										{c.basis}:{" "}
										<span
											className={`font-mono font-medium ${
												basis >= 0 ? "text-forest-700" : "text-semantic-alert"
											}`}
										>
											{formatBasisEur(basis, locale)}
										</span>
									</span>
								) : null}
							</div>
						) : null}
					</div>
				))}
			</div>

			<p className="mt-2 text-[10px] text-ink/40 leading-snug">{c.basisHint}</p>

			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => addBuyer()}
					className="rounded-lg border border-forest-700/25 px-3 py-1.5 text-[12px] font-medium text-forest-800 hover:bg-forest-700/10"
				>
					{c.add}
				</button>
				<button
					type="button"
					onClick={() =>
						addBuyer(locale === "bg" ? PRESETS.elevator.bg : PRESETS.elevator.en)
					}
					className="rounded-lg border border-ink/15 px-3 py-1.5 text-[12px] text-ink/70 hover:bg-white"
				>
					{c.presetElevator}
				</button>
				<button
					type="button"
					onClick={() => addBuyer(locale === "bg" ? PRESETS.coop.bg : PRESETS.coop.en)}
					className="rounded-lg border border-ink/15 px-3 py-1.5 text-[12px] text-ink/70 hover:bg-white"
				>
					{c.presetCoop}
				</button>
			</div>
		</div>
	);
}
