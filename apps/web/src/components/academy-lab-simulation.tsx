"use client";

import { useMemo, useState } from "react";
import {
	type CropId,
	type LabInputs,
	CROP_LABELS,
	runLabSimulation,
} from "@/lib/academy-lab-simulation";

const defaultInputs: LabInputs = {
	crop: "wheat",
	areaHa: 10,
	soilN: 55,
	soilP: 48,
	soilK: 52,
	organicMatterPct: 3.8,
	ph: 6.5,
	seasonRainMm: 320,
	avgTempC: 18,
	frostRiskDays: 2,
	costSeed: 120,
	costFert: 280,
	costFuel: 95,
	costChem: 140,
	costOther: 60,
	expectedPricePerTon: 240,
};

function Field({
	label,
	className,
	children,
}: {
	label: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<label className={className ?? "block"}>
			<span className="text-xs font-medium text-slate-600">{label}</span>
			<div className="mt-1">{children}</div>
		</label>
	);
}

export function AcademyLabSimulation() {
	const [i, setI] = useState<LabInputs>(defaultInputs);

	const result = useMemo(() => runLabSimulation(i), [i]);

	function num<K extends keyof LabInputs>(key: K, v: string, int = false) {
		const n = int ? parseInt(v, 10) : parseFloat(v);
		setI((p) => ({ ...p, [key]: Number.isFinite(n) ? n : 0 }));
	}

	return (
		<div className="space-y-8">
			<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
				<strong>Учебна симулация.</strong> Числата са оценъчни — за реални решения ползвайте агроном, лабораторни анализи и
				официални пазарни данни.
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-sm font-semibold text-emerald-900">Култура и площ</h2>
					<div className="mt-4 space-y-4">
						<Field label="Култура">
							<select
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
								value={i.crop}
								onChange={(e) => setI((p) => ({ ...p, crop: e.target.value as CropId }))}
							>
								{(Object.keys(CROP_LABELS) as CropId[]).map((c) => (
									<option key={c} value={c}>
										{CROP_LABELS[c]}
									</option>
								))}
							</select>
						</Field>
						<Field label="Площ (ha)">
							<input
								type="number"
								min={0.1}
								step={0.1}
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
								value={i.areaHa}
								onChange={(e) => num("areaHa", e.target.value)}
							/>
						</Field>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-sm font-semibold text-emerald-900">Почва (условни показатели)</h2>
					<p className="mt-1 text-xs text-slate-500">Плъзнете като „проба–грешка“ и вижте резултата вдясно.</p>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<Field label="N (наличност 0–120)">
							<input
								type="range"
								min={0}
								max={120}
								value={i.soilN}
								onChange={(e) => num("soilN", e.target.value, true)}
							/>
							<span className="text-xs text-slate-600">{i.soilN}</span>
						</Field>
						<Field label="P (0–120)">
							<input
								type="range"
								min={0}
								max={120}
								value={i.soilP}
								onChange={(e) => num("soilP", e.target.value, true)}
							/>
							<span className="text-xs text-slate-600">{i.soilP}</span>
						</Field>
						<Field label="K (0–120)">
							<input
								type="range"
								min={0}
								max={120}
								value={i.soilK}
								onChange={(e) => num("soilK", e.target.value, true)}
							/>
							<span className="text-xs text-slate-600">{i.soilK}</span>
						</Field>
						<Field label="Органична маса (%)">
							<input
								type="range"
								min={0}
								max={12}
								step={0.1}
								value={i.organicMatterPct}
								onChange={(e) => num("organicMatterPct", e.target.value)}
							/>
							<span className="text-xs text-slate-600">{i.organicMatterPct}</span>
						</Field>
						<Field label="pH">
							<input
								type="range"
								min={4.5}
								max={8.5}
								step={0.1}
								value={i.ph}
								onChange={(e) => num("ph", e.target.value)}
							/>
							<span className="text-xs text-slate-600">{i.ph}</span>
						</Field>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-sm font-semibold text-emerald-900">Време (сезон)</h2>
					<div className="mt-4 space-y-4">
						<Field label="Валежи (mm за сезона)">
							<input
								type="range"
								min={80}
								max={600}
								value={i.seasonRainMm}
								onChange={(e) => num("seasonRainMm", e.target.value, true)}
							/>
							<span className="text-xs text-slate-600">{i.seasonRainMm} mm</span>
						</Field>
						<Field label="Средна температура (°C)">
							<input
								type="range"
								min={8}
								max={30}
								step={0.5}
								value={i.avgTempC}
								onChange={(e) => num("avgTempC", e.target.value)}
							/>
							<span className="text-xs text-slate-600">{i.avgTempC} °C</span>
						</Field>
						<Field label="Дни със сланинов / метео стрес">
							<input
								type="range"
								min={0}
								max={14}
								value={i.frostRiskDays}
								onChange={(e) => num("frostRiskDays", e.target.value, true)}
							/>
							<span className="text-xs text-slate-600">{i.frostRiskDays} дни</span>
						</Field>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-sm font-semibold text-emerald-900">Разходи (€/ha) и цена</h2>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						{(
							[
								["costSeed", "Семе"],
								["costFert", "Торове"],
								["costFuel", "Гориво/механизация"],
								["costChem", "Защита (ХВП)"],
								["costOther", "Други"],
							] as const
						).map(([key, lab]) => (
							<Field key={key} label={`${lab} €/ha`}>
								<input
									type="number"
									min={0}
									step={5}
									className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
									value={i[key]}
									onChange={(e) => num(key, e.target.value)}
								/>
							</Field>
						))}
						<Field label="Очаквана продажна цена (€/t)" className="sm:col-span-2">
							<input
								type="number"
								min={0}
								step={5}
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
								value={i.expectedPricePerTon}
								onChange={(e) => num("expectedPricePerTon", e.target.value)}
							/>
						</Field>
					</div>
				</section>
			</div>

			<section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
				<h2 className="text-sm font-semibold text-emerald-950">Резултат (учебен)</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-emerald-800">Оценка на засаждането</p>
						<p className="text-3xl font-bold text-emerald-950">{result.plantingSuccessScore} / 100</p>
						<p className="mt-2 text-sm text-slate-800">{result.verdictBg}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-emerald-800">Очакван добив</p>
						<p className="text-3xl font-bold text-emerald-950">{result.estimatedYieldPerHa} t/ha</p>
						<p className="mt-1 text-xs text-slate-600">
							≈ {Math.round(result.estimatedYieldPerHa * i.areaHa * 10) / 10} t общо за {i.areaHa} ha
						</p>
					</div>
					<div className="sm:col-span-2 rounded-xl border border-white/60 bg-white/90 p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Пари (симулация)</p>
						<ul className="mt-2 space-y-1 text-sm text-slate-800">
							<li>Общи разходи: {result.totalCostEur.toLocaleString("bg-BG")} €</li>
							<li>Очакван приход: {result.grossRevenueEur.toLocaleString("bg-BG")} €</li>
							<li className={result.netProfitEur >= 0 ? "font-semibold text-emerald-800" : "font-semibold text-red-700"}>
								Нето (приход − разход): {result.netProfitEur >= 0 ? "+" : ""}
								{result.netProfitEur.toLocaleString("bg-BG")} € {result.netProfitEur >= 0 ? "(на плюс)" : "(на минус)"}
							</li>
						</ul>
					</div>
				</div>
				<ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
					{result.hintsBg.map((h, idx) => (
						<li key={idx}>{h}</li>
					))}
				</ul>
			</section>
		</div>
	);
}
