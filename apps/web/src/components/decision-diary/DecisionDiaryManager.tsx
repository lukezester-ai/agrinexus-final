"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { BreakEvenInputs } from "@/lib/break-even";
import { formatEur } from "@/lib/break-even";
import { formatBasisEur, quoteToEurPerTonne, type PriceCurrency } from "@/lib/local-price";
import {
	buildMarketSnapshot,
	type DecisionAction,
	type DecisionDiaryEntry,
	type NewDecisionInput,
	formatDecisionDate,
	isDecisionAction,
	loadDiaryFromStorage,
	parseDecisionRow,
	saveDiaryToStorage,
} from "@/lib/decision-diary";

type Props = {
	locale: string;
	initialEntries: DecisionDiaryEntry[];
	breakEven: BreakEvenInputs | null;
	totalHa: number;
};

const copy = {
	en: {
		title: "Decision diary",
		sub: "Log what you decided and why — we snapshot market context for later review (feeds signal calibration over time).",
		add: "Log decision",
		cancel: "Cancel",
		date: "Decision date",
		action: "Action",
		tonnes: "Volume (t, optional)",
		price: "Price / t (optional)",
		currency: "Currency",
		buyer: "Buyer (optional)",
		why: "Why did you decide this?",
		save: "Save entry",
		saving: "Saving…",
		empty: "No entries yet. Log your first sell, hold, or forward choice.",
		snapshot: "Market at decision time",
		outcome: "Outcome (review later)",
		outcomePlaceholder: "What happened after harvest / delivery?",
		rating: "How did it turn out?",
		ratingUnset: "—",
		delete: "Delete",
		sql: "Run apps/backend/rag/decision_diary.sql in Supabase if save fails.",
		actions: {
			sell: "Sell / deliver",
			hold: "Hold",
			forward: "Forward / contract",
			hedge: "Hedge",
			other: "Other",
		} satisfies Record<DecisionAction, string>,
		ratings: ["Regret", "Below plan", "OK", "Good", "Great"],
		settings: "Break-even & buyers",
		disclaimer: "Your diary is private. Not legal or trading advice.",
	},
	bg: {
		title: "Дневник на решения",
		sub: "Записвай какво реши и защо — пазим контекста на пазара за по-късен преглед (ползва се за калибриране на сигналите).",
		add: "Запиши решение",
		cancel: "Отказ",
		date: "Дата на решението",
		action: "Действие",
		tonnes: "Количество (t, по избор)",
		price: "Цена / t (по избор)",
		currency: "Валута",
		buyer: "Купувач (по избор)",
		why: "Защо взе това решение?",
		save: "Запази",
		saving: "Запазване…",
		empty: "Няма записи. Добави първото си решение — продажба, задържане или форуърд.",
		snapshot: "Пазар при решението",
		outcome: "Резултат (попълни по-късно)",
		outcomePlaceholder: "Какво се случи след жътва / доставка?",
		rating: "Как се получи?",
		ratingUnset: "—",
		delete: "Изтрий",
		sql: "Пусни apps/backend/rag/decision_diary.sql в Supabase при грешка при запис.",
		actions: {
			sell: "Продажба / доставка",
			hold: "Задържам",
			forward: "Форуърд / договор",
			hedge: "Хедж",
			other: "Друго",
		} satisfies Record<DecisionAction, string>,
		ratings: ["Съжалявам", "Под плана", "ОК", "Добре", "Отлично"],
		settings: "Себестойност и купувачи",
		disclaimer: "Дневникът е само за теб. Не е правен или търговски съвет.",
	},
};

function sortEntries(entries: DecisionDiaryEntry[]): DecisionDiaryEntry[] {
	return [...entries].sort(
		(a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime(),
	);
}

export default function DecisionDiaryManager({
	locale,
	initialEntries,
	breakEven,
	totalHa,
}: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const { user } = useAuth();
	const [entries, setEntries] = useState<DecisionDiaryEntry[]>(() =>
		initialEntries.length > 0 ? sortEntries(initialEntries) : sortEntries(loadDiaryFromStorage()),
	);
	const [isAdding, setIsAdding] = useState(false);
	const [saving, setSaving] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	const [decidedAt, setDecidedAt] = useState(() => new Date().toISOString().slice(0, 10));
	const [action, setAction] = useState<DecisionAction>("hold");
	const [tonnes, setTonnes] = useState("");
	const [price, setPrice] = useState("");
	const [currency, setCurrency] = useState<PriceCurrency>("EUR");
	const [buyerName, setBuyerName] = useState("");
	const [rationale, setRationale] = useState("");

	const actionOptions = useMemo(
		() =>
			(["sell", "hold", "forward", "hedge", "other"] as const).map((key) => ({
				key,
				label: c.actions[key],
			})),
		[c.actions],
	);

	const resetForm = () => {
		setDecidedAt(new Date().toISOString().slice(0, 10));
		setAction("hold");
		setTonnes("");
		setPrice("");
		setCurrency("EUR");
		setBuyerName("");
		setRationale("");
	};

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setSaving(true);

		const input: NewDecisionInput = {
			decided_at: new Date(decidedAt).toISOString(),
			action,
			tonnes: tonnes ? parseFloat(tonnes) : undefined,
			price_per_tonne: price ? parseFloat(price) : undefined,
			price_currency: currency,
			buyer_name: buyerName.trim() || undefined,
			rationale: rationale.trim() || undefined,
		};

		let wheatPriceStr: string | null = null;
		let cbotEur: number | null = null;
		try {
			const refRes = await fetch("/api/market/wheat-ref");
			if (refRes.ok) {
				const ref = (await refRes.json()) as {
					priceStr?: string | null;
					cbotEurPerTonne?: number | null;
				};
				wheatPriceStr = ref.priceStr ?? null;
				cbotEur = ref.cbotEurPerTonne ?? null;
			}
		} catch {
			/* snapshot optional */
		}

		const market_snapshot = await buildMarketSnapshot({
			wheatPriceStr,
			cbotEurPerTonne: cbotEur,
			breakEven,
			totalHa,
		});

		const row = {
			user_id: user.id,
			decided_at: input.decided_at,
			crop: "wheat",
			action: input.action,
			tonnes: input.tonnes ?? null,
			price_per_tonne: input.price_per_tonne ?? null,
			price_currency: input.price_currency ?? "EUR",
			buyer_name: input.buyer_name ?? null,
			rationale: input.rationale ?? null,
			market_snapshot,
			updated_at: new Date().toISOString(),
		};

		const { data, error } = await supabase
			.from("decision_diary_entries")
			.insert(row)
			.select()
			.single();

		if (!error && data) {
			const parsed = parseDecisionRow(data as Record<string, unknown>);
			if (parsed) {
				const next = sortEntries([parsed, ...entries]);
				setEntries(next);
				saveDiaryToStorage(next);
			}
			resetForm();
			setIsAdding(false);
		} else {
			const fallback: DecisionDiaryEntry = {
				id: `local-${Date.now()}`,
				user_id: user.id,
				decided_at: input.decided_at,
				crop: "wheat",
				action: input.action,
				tonnes: input.tonnes ?? null,
				price_per_tonne: input.price_per_tonne ?? null,
				price_currency: input.price_currency ?? "EUR",
				buyer_name: input.buyer_name ?? null,
				rationale: input.rationale ?? null,
				market_snapshot,
				outcome_notes: null,
				outcome_rating: null,
			};
			const next = sortEntries([fallback, ...entries]);
			setEntries(next);
			saveDiaryToStorage(next);
			resetForm();
			setIsAdding(false);
			alert(c.sql);
		}
		setSaving(false);
	};

	const updateOutcome = async (
		entry: DecisionDiaryEntry,
		patch: { outcome_notes?: string; outcome_rating?: number | null },
	) => {
		const nextNotes = patch.outcome_notes ?? entry.outcome_notes;
		const nextRating =
			patch.outcome_rating !== undefined ? patch.outcome_rating : entry.outcome_rating;

		if (!entry.id.startsWith("local-")) {
			await supabase
				.from("decision_diary_entries")
				.update({
					outcome_notes: nextNotes,
					outcome_rating: nextRating,
					updated_at: new Date().toISOString(),
				})
				.eq("id", entry.id);
		}

		const updated = entries.map((e) =>
			e.id === entry.id
				? { ...e, outcome_notes: nextNotes ?? null, outcome_rating: nextRating ?? null }
				: e,
		);
		setEntries(updated);
		saveDiaryToStorage(updated);
	};

	const handleDelete = async (id: string) => {
		if (!confirm(locale === "bg" ? "Изтриване на записа?" : "Delete this entry?")) return;
		if (!id.startsWith("local-")) {
			await supabase.from("decision_diary_entries").delete().eq("id", id);
		}
		const next = entries.filter((e) => e.id !== id);
		setEntries(next);
		saveDiaryToStorage(next);
	};

	return (
		<div className="max-w-3xl">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-serif text-2xl font-normal tracking-tight text-ink">{c.title}</h1>
					<p className="mt-1.5 text-sm text-ink/60 max-w-xl">{c.sub}</p>
					<p className="mt-2 text-[10px] text-ink/45">{c.disclaimer}</p>
				</div>
				<button
					type="button"
					onClick={() => {
						setIsAdding(!isAdding);
						setEditingId(null);
					}}
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
				>
					{isAdding ? c.cancel : c.add}
				</button>
			</div>

			{!breakEven ? (
				<p className="mb-4 text-xs text-ink/55">
					<Link href="/dashboard/settings" className="text-forest-700 underline">
						{c.settings}
					</Link>
				</p>
			) : null}

			{isAdding ? (
				<form
					onSubmit={handleAdd}
					className="mb-8 rounded-2xl border border-white/70 bg-white/55 p-5 backdrop-blur-xl"
				>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<label className="flex flex-col gap-1 text-xs text-ink/70">
							{c.date}
							<input
								type="date"
								required
								value={decidedAt}
								onChange={(e) => setDecidedAt(e.target.value)}
								className="rounded-xl border border-ink/10 px-3 py-2 text-sm"
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs text-ink/70">
							{c.action}
							<select
								value={action}
								onChange={(e) => {
									const v = e.target.value;
									if (isDecisionAction(v)) setAction(v);
								}}
								className="rounded-xl border border-ink/10 px-3 py-2 text-sm bg-white"
							>
								{actionOptions.map((o) => (
									<option key={o.key} value={o.key}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1 text-xs text-ink/70">
							{c.tonnes}
							<input
								type="number"
								min={0}
								step={1}
								value={tonnes}
								onChange={(e) => setTonnes(e.target.value)}
								className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-mono"
							/>
						</label>
						<div className="grid grid-cols-2 gap-2">
							<label className="flex flex-col gap-1 text-xs text-ink/70">
								{c.price}
								<input
									type="number"
									min={0}
									value={price}
									onChange={(e) => setPrice(e.target.value)}
									className="rounded-xl border border-ink/10 px-3 py-2 text-sm font-mono"
								/>
							</label>
							<label className="flex flex-col gap-1 text-xs text-ink/70">
								{c.currency}
								<select
									value={currency}
									onChange={(e) => setCurrency(e.target.value as PriceCurrency)}
									className="rounded-xl border border-ink/10 px-3 py-2 text-sm bg-white"
								>
									<option value="EUR">EUR</option>
									<option value="BGN">BGN</option>
								</select>
							</label>
						</div>
						<label className="flex flex-col gap-1 text-xs text-ink/70 sm:col-span-2">
							{c.buyer}
							<input
								type="text"
								value={buyerName}
								onChange={(e) => setBuyerName(e.target.value)}
								className="rounded-xl border border-ink/10 px-3 py-2 text-sm"
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs text-ink/70 sm:col-span-2">
							{c.why}
							<textarea
								required
								rows={3}
								value={rationale}
								onChange={(e) => setRationale(e.target.value)}
								className="rounded-xl border border-ink/10 px-3 py-2 text-sm resize-y"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={saving}
						className="mt-4 rounded-xl bg-forest-700 px-5 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
					>
						{saving ? c.saving : c.save}
					</button>
				</form>
			) : null}

			{entries.length === 0 ? (
				<p className="text-sm text-ink/50">{c.empty}</p>
			) : (
				<ul className="flex flex-col gap-4">
					{entries.map((entry) => (
						<li
							key={entry.id}
							className="rounded-2xl border border-ink/10 bg-white/55 p-4 backdrop-blur-sm"
						>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div>
									<div className="font-medium text-ink">
										{c.actions[entry.action]} · {formatDecisionDate(entry.decided_at, locale)}
									</div>
									{entry.rationale ? (
										<p className="mt-1 text-sm text-ink/70">{entry.rationale}</p>
									) : null}
								</div>
								<button
									type="button"
									onClick={() => handleDelete(entry.id)}
									className="text-[11px] text-semantic-alert hover:underline"
								>
									{c.delete}
								</button>
							</div>

							<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/55 font-mono">
								{entry.tonnes != null && entry.tonnes > 0 ? (
									<span>{entry.tonnes} t</span>
								) : null}
								{entry.price_per_tonne != null && entry.price_per_tonne > 0 ? (
									<span>
										{entry.price_per_tonne} {entry.price_currency}/t →{" "}
										{formatEur(
											quoteToEurPerTonne(entry.price_per_tonne, entry.price_currency),
											locale,
										)}
										/t
									</span>
								) : null}
								{entry.buyer_name ? <span>{entry.buyer_name}</span> : null}
							</div>

							{entry.market_snapshot ? (
								<div className="mt-3 rounded-lg bg-ink/[0.03] px-3 py-2 text-[11px] text-ink/55">
									<div className="font-medium text-ink/65 mb-1">{c.snapshot}</div>
									{entry.market_snapshot.cbot_price_str ? (
										<div>CBOT: {entry.market_snapshot.cbot_price_str}</div>
									) : null}
									{entry.market_snapshot.margin_eur_per_tonne != null ? (
										<div>
											Margin:{" "}
											{formatEur(entry.market_snapshot.margin_eur_per_tonne, locale)}/t
										</div>
									) : null}
									{entry.market_snapshot.basis_eur_per_tonne != null ? (
										<div>
											Basis:{" "}
											{formatBasisEur(entry.market_snapshot.basis_eur_per_tonne, locale)}
										</div>
									) : null}
								</div>
							) : null}

							<div className="mt-3 border-t border-ink/8 pt-3">
								<div className="text-[10px] uppercase tracking-wide text-ink/45 mb-2">
									{c.outcome}
								</div>
								{editingId === entry.id ? (
									<div className="space-y-2">
										<textarea
											rows={2}
											defaultValue={entry.outcome_notes ?? ""}
											id={`outcome-${entry.id}`}
											placeholder={c.outcomePlaceholder}
											className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm"
										/>
										<select
											defaultValue={entry.outcome_rating ?? ""}
											id={`rating-${entry.id}`}
											className="rounded-lg border border-ink/10 px-3 py-2 text-sm bg-white"
										>
											<option value="">{c.ratingUnset}</option>
											{c.ratings.map((label, i) => (
												<option key={label} value={i + 1}>
													{i + 1} — {label}
												</option>
											))}
										</select>
										<button
											type="button"
											className="text-xs text-forest-700 font-medium"
											onClick={() => {
												const notes = (
													document.getElementById(
														`outcome-${entry.id}`,
													) as HTMLTextAreaElement
												).value;
												const ratingRaw = (
													document.getElementById(
														`rating-${entry.id}`,
													) as HTMLSelectElement
												).value;
												updateOutcome(entry, {
													outcome_notes: notes,
													outcome_rating: ratingRaw ? parseInt(ratingRaw, 10) : null,
												});
												setEditingId(null);
											}}
										>
											{c.save}
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setEditingId(entry.id)}
										className="text-xs text-forest-700 hover:underline"
									>
										{entry.outcome_notes || entry.outcome_rating
											? entry.outcome_notes ?? c.ratings[(entry.outcome_rating ?? 3) - 1]
											: c.outcome}
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
