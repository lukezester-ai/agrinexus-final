import { useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';

type Props = {
	lang: UiLang;
	tr: AppStrings;
};

type FoodSecPreset = 'custom' | 'urbanStaple' | 'exportCorridor' | 'bufferReserve';

type FoodSecInputs = {
	population: number;
	kgPerCapitaYear: number;
	manualSupplyTonnes: number;
	yieldTPerHa: number;
	variableCostEurPerHa: number;
	fixedProgrammeEur: number;
	referencePriceEurPerT: number;
};

type FoodSecDerived = {
	usePop: boolean;
	supplyTonnes: number;
	ha: number;
	totalCost: number;
	breakEvenPrice: number;
	revenue: number;
	marginTotal: number;
	marginPerT: number;
	breakEvenYieldAtRef: number;
};

const HYPOTHESIS_STORAGE_KEY = 'agrinexus-foodsec-hypothesis';

function deriveFoodSec(i: FoodSecInputs): FoodSecDerived {
	const usePop = i.population > 0;
	const supplyTonnes = usePop
		? (i.population * i.kgPerCapitaYear) / 1000
		: Math.max(0, i.manualSupplyTonnes);
	const ha = i.yieldTPerHa > 0 ? supplyTonnes / i.yieldTPerHa : 0;
	const totalCost = Math.max(0, i.fixedProgrammeEur) + ha * Math.max(0, i.variableCostEurPerHa);
	const breakEvenPrice = supplyTonnes > 0 ? totalCost / supplyTonnes : 0;
	const revenue = supplyTonnes * Math.max(0, i.referencePriceEurPerT);
	const marginTotal = revenue - totalCost;
	const marginPerT = supplyTonnes > 0 ? marginTotal / supplyTonnes : 0;
	const breakEvenYieldAtRef =
		ha > 0 && i.referencePriceEurPerT > 0 ? totalCost / (ha * i.referencePriceEurPerT) : 0;
	return {
		usePop,
		supplyTonnes,
		ha,
		totalCost,
		breakEvenPrice,
		revenue,
		marginTotal,
		marginPerT,
		breakEvenYieldAtRef,
	};
}

const PRESETS: Record<Exclude<FoodSecPreset, 'custom'>, FoodSecInputs> = {
	urbanStaple: {
		population: 320_000,
		kgPerCapitaYear: 155,
		manualSupplyTonnes: 45_000,
		yieldTPerHa: 4.3,
		variableCostEurPerHa: 535,
		fixedProgrammeEur: 18_500_000,
		referencePriceEurPerT: 228,
	},
	exportCorridor: {
		population: 0,
		kgPerCapitaYear: 180,
		manualSupplyTonnes: 95_000,
		yieldTPerHa: 5.6,
		variableCostEurPerHa: 590,
		fixedProgrammeEur: 7_200_000,
		referencePriceEurPerT: 252,
	},
	bufferReserve: {
		population: 0,
		kgPerCapitaYear: 180,
		manualSupplyTonnes: 42_000,
		yieldTPerHa: 3.9,
		variableCostEurPerHa: 780,
		fixedProgrammeEur: 22_000_000,
		referencePriceEurPerT: 236,
	},
};

export function FoodSecurityBreakEvenView({ lang, tr }: Props) {
	const locale = lang === 'bg' ? 'bg-BG' : 'en-GB';
	const [preset, setPreset] = useState<FoodSecPreset>('urbanStaple');

	const [population, setPopulation] = useState(PRESETS.urbanStaple.population);
	const [kgPerCapitaYear, setKgPerCapitaYear] = useState(PRESETS.urbanStaple.kgPerCapitaYear);
	const [manualSupplyTonnes, setManualSupplyTonnes] = useState(PRESETS.urbanStaple.manualSupplyTonnes);
	const [yieldTPerHa, setYieldTPerHa] = useState(PRESETS.urbanStaple.yieldTPerHa);
	const [variableCostEurPerHa, setVariableCostEurPerHa] = useState(PRESETS.urbanStaple.variableCostEurPerHa);
	const [fixedProgrammeEur, setFixedProgrammeEur] = useState(PRESETS.urbanStaple.fixedProgrammeEur);
	const [referencePriceEurPerT, setReferencePriceEurPerT] = useState(PRESETS.urbanStaple.referencePriceEurPerT);

	const [hypothesis, setHypothesis] = useState('');

	useEffect(() => {
		try {
			const saved = localStorage.getItem(HYPOTHESIS_STORAGE_KEY);
			if (saved) setHypothesis(saved);
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(HYPOTHESIS_STORAGE_KEY, hypothesis);
		} catch {
			/* ignore */
		}
	}, [hypothesis]);

	const markCustom = () => setPreset('custom');

	const applyPreset = (p: Exclude<FoodSecPreset, 'custom'>) => {
		const s = PRESETS[p];
		setPreset(p);
		setPopulation(s.population);
		setKgPerCapitaYear(s.kgPerCapitaYear);
		setManualSupplyTonnes(s.manualSupplyTonnes);
		setYieldTPerHa(s.yieldTPerHa);
		setVariableCostEurPerHa(s.variableCostEurPerHa);
		setFixedProgrammeEur(s.fixedProgrammeEur);
		setReferencePriceEurPerT(s.referencePriceEurPerT);
	};

	const baseInputs: FoodSecInputs = useMemo(
		() => ({
			population,
			kgPerCapitaYear,
			manualSupplyTonnes,
			yieldTPerHa,
			variableCostEurPerHa,
			fixedProgrammeEur,
			referencePriceEurPerT,
		}),
		[
			population,
			kgPerCapitaYear,
			manualSupplyTonnes,
			yieldTPerHa,
			variableCostEurPerHa,
			fixedProgrammeEur,
			referencePriceEurPerT,
		],
	);

	const derived = useMemo(() => deriveFoodSec(baseInputs), [baseInputs]);

	const sensitivityRows = useMemo(() => {
		const rows: { label: string; inputs: FoodSecInputs }[] = [
			{ label: tr.foodSecSensRowBase, inputs: baseInputs },
			{
				label: tr.foodSecSensRowPriceDown,
				inputs: { ...baseInputs, referencePriceEurPerT: baseInputs.referencePriceEurPerT * 0.85 },
			},
			{
				label: tr.foodSecSensRowPriceUp,
				inputs: { ...baseInputs, referencePriceEurPerT: baseInputs.referencePriceEurPerT * 1.1 },
			},
			{
				label: tr.foodSecSensRowYieldDown,
				inputs: { ...baseInputs, yieldTPerHa: baseInputs.yieldTPerHa * 0.85 },
			},
		];
		return rows.map(r => ({ label: r.label, d: deriveFoodSec(r.inputs) }));
	}, [baseInputs, tr]);

	const angleBullets = useMemo(() => {
		const out: string[] = [];
		const { totalCost, breakEvenPrice, marginTotal, ha, supplyTonnes } = derived;
		const ref = Math.max(0, referencePriceEurPerT);
		const gapPct =
			ref > 0 && supplyTonnes > 0 ? ((ref - breakEvenPrice) / ref) * 100 : 0;
		const fixedShare = totalCost > 0 ? fixedProgrammeEur / totalCost : 0;

		if (supplyTonnes <= 0 || yieldTPerHa <= 0) return out;

		if (marginTotal >= 0 && gapPct >= 6) {
			out.push(tr.foodSecAnglePositiveSpread.replace('{pct}', gapPct.toFixed(1)));
		}
		if (marginTotal < 0 || breakEvenPrice > ref * 1.02) {
			out.push(tr.foodSecAngleNegativeSpread);
		}
		if (fixedShare >= 0.34) {
			out.push(tr.foodSecAngleFixedHeavy.replace('{pct}', Math.round(fixedShare * 100).toString()));
		}
		if (ha >= 22_000) {
			out.push(tr.foodSecAngleLandHeavy.replace('{ha}', Math.round(ha).toLocaleString(locale)));
		}
		if (marginTotal >= 0 && gapPct >= 0 && gapPct < 6) {
			out.push(tr.foodSecAngleThinBuffer);
		}
		return out;
	}, [derived, fixedProgrammeEur, referencePriceEurPerT, tr, locale, yieldTPerHa]);

	const marginPositive = derived.marginTotal >= 0;
	const statusLine = marginPositive
		? tr.foodSecMarginTotalProfit.replace('{eur}', String(Math.round(derived.marginTotal)))
		: tr.foodSecMarginTotalLoss.replace('{eur}', String(Math.round(Math.abs(derived.marginTotal))));

	const presetButtons: { id: Exclude<FoodSecPreset, 'custom'>; label: string }[] = [
		{ id: 'urbanStaple', label: tr.foodSecPresetUrbanStaple },
		{ id: 'exportCorridor', label: tr.foodSecPresetExportCorridor },
		{ id: 'bufferReserve', label: tr.foodSecPresetBufferReserve },
	];

	return (
		<section className="section">
			<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
				<Shield size={26} color="#7ccd9c" aria-hidden />
				{tr.foodSecTitle}
			</h2>
			<p className="muted" style={{ marginTop: 10, lineHeight: 1.58 }}>
				{tr.foodSecSubtitle}
			</p>

			<div style={{ marginTop: 16, marginBottom: 14 }}>
				<span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '.9rem' }}>
					{tr.foodSecPresetsTitle}
				</span>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{presetButtons.map(b => (
						<button
							key={b.id}
							type="button"
							className={preset === b.id ? 'btn btn-primary' : 'btn btn-outline'}
							onClick={() => applyPreset(b.id)}>
							{b.label}
						</button>
					))}
				</div>
				{preset === 'custom' ? (
					<p className="muted" style={{ margin: '8px 0 0', fontSize: '.82rem' }}>
						{tr.foodSecPresetCustomActive}
					</p>
				) : null}
				<p className="muted" style={{ margin: '8px 0 0', fontSize: '.82rem', lineHeight: 1.5 }}>
					{tr.foodSecPresetHint}
				</p>
			</div>

			<div
				className="contact-panel"
				style={{
					marginTop: 4,
					borderColor: 'rgba(124, 205, 156, 0.35)',
					background: 'linear-gradient(165deg, rgba(124,205,156,0.09) 0%, rgba(12,22,17,0.48) 100%)',
				}}>
				<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tr.foodSecInputsTitle}</h3>
				<p className="muted" style={{ margin: '0 0 14px', fontSize: '.88rem', lineHeight: 1.5 }}>
					{tr.foodSecInputsHint}
				</p>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
						gap: 12,
						marginBottom: 14,
					}}>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecPopulation}
						<input
							type="number"
							min={0}
							step={1000}
							value={population}
							onChange={e => {
								markCustom();
								setPopulation(Math.max(0, Number(e.target.value) || 0));
							}}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecKgPerCapita}
						<input
							type="number"
							min={0}
							step={10}
							value={kgPerCapitaYear}
							onChange={e => {
								markCustom();
								setKgPerCapitaYear(Math.max(0, Number(e.target.value) || 0));
							}}
							disabled={population <= 0}
							style={population <= 0 ? { opacity: 0.55 } : undefined}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecManualTonnes}
						<input
							type="number"
							min={0}
							step={500}
							value={manualSupplyTonnes}
							onChange={e => {
								markCustom();
								setManualSupplyTonnes(Math.max(0, Number(e.target.value) || 0));
							}}
							disabled={population > 0}
							style={population > 0 ? { opacity: 0.55 } : undefined}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecYield}
						<input
							type="number"
							min={0}
							step={0.1}
							value={yieldTPerHa}
							onChange={e => {
								markCustom();
								setYieldTPerHa(Math.max(0, Number(e.target.value) || 0));
							}}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecVarCostHa}
						<input
							type="number"
							min={0}
							step={10}
							value={variableCostEurPerHa}
							onChange={e => {
								markCustom();
								setVariableCostEurPerHa(Math.max(0, Number(e.target.value) || 0));
							}}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecFixedProgramme}
						<input
							type="number"
							min={0}
							step={10000}
							value={fixedProgrammeEur}
							onChange={e => {
								markCustom();
								setFixedProgrammeEur(Math.max(0, Number(e.target.value) || 0));
							}}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecReferencePrice}
						<input
							type="number"
							min={0}
							step={1}
							value={referencePriceEurPerT}
							onChange={e => {
								markCustom();
								setReferencePriceEurPerT(Math.max(0, Number(e.target.value) || 0));
							}}
						/>
					</label>
				</div>
				<p className="muted" style={{ margin: '0 0 16px', fontSize: '.82rem' }}>
					{tr.foodSecPopulationHint}
				</p>

				<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tr.foodSecResultsTitle}</h3>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
						gap: 10,
					}}>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecSupplyTonnes}</strong>{' '}
						{`${derived.supplyTonnes.toLocaleString(locale, { maximumFractionDigits: 0 })} t`}
						{derived.usePop ? ` (${tr.foodSecFromPopulation})` : ` (${tr.foodSecManualMode})`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecLandHa}</strong> {`${derived.ha.toFixed(1)} ha`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecTotalCost}</strong>{' '}
						{`${Math.round(derived.totalCost).toLocaleString(locale)} EUR`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecBreakEvenPrice}</strong> {`${derived.breakEvenPrice.toFixed(1)} EUR/t`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecBreakEvenYield}</strong>{' '}
						{yieldTPerHa > 0 && referencePriceEurPerT > 0
							? `${derived.breakEvenYieldAtRef.toFixed(2)} t/ha`
							: '—'}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecMarginPerT}</strong>{' '}
						{`${derived.marginPerT.toFixed(1)} EUR/t (${tr.foodSecAtReferencePrice})`}
					</p>
				</div>
				<p
					className="muted"
					style={{
						margin: '12px 0 0',
						lineHeight: 1.55,
						color: marginPositive ? '#86efac' : '#fdba74',
					}}>
					{statusLine}
				</p>
			</div>

			<div
				className="contact-panel"
				style={{
					marginTop: 18,
					borderColor: 'rgba(168, 85, 247, 0.28)',
					background: 'linear-gradient(165deg, rgba(168,85,247,0.07) 0%, rgba(12,22,17,0.42) 100%)',
				}}>
				<h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>{tr.foodSecSensitivityTitle}</h3>
				<p className="muted" style={{ margin: '0 0 12px', fontSize: '.86rem', lineHeight: 1.55 }}>
					{tr.foodSecSensitivityHint}
				</p>
				<div className="table-shell">
					<table className="data-table">
						<thead>
							<tr>
								<th>{tr.foodSecSensitivityColCase}</th>
								<th>{tr.foodSecSensitivityColMarginTotal}</th>
								<th>{tr.foodSecSensitivityColMarginPerT}</th>
								<th>{tr.foodSecSensitivityColLandHa}</th>
							</tr>
						</thead>
						<tbody>
							{sensitivityRows.map((row, idx) => (
								<tr key={row.label} style={idx % 2 ? { background: 'rgba(15,23,42,0.08)' } : undefined}>
									<td style={{ color: '#e2e8f0' }}>{row.label}</td>
									<td
										style={{
											color: row.d.marginTotal >= 0 ? '#86efac' : '#fdba74',
											fontWeight: 600,
										}}>
										{`${Math.round(row.d.marginTotal).toLocaleString(locale)} EUR`}
									</td>
									<td style={{ color: '#cbd5e1' }}>
										{`${row.d.marginPerT.toFixed(1)} EUR/t`}
									</td>
									<td style={{ color: '#cbd5e1' }}>{`${row.d.ha.toFixed(1)} ha`}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div
				className="contact-panel"
				style={{
					marginTop: 18,
					borderColor: 'rgba(56, 189, 248, 0.3)',
					background: 'rgba(56, 189, 248, 0.06)',
				}}>
				<h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>{tr.foodSecAnglesTitle}</h3>
				<p className="muted" style={{ margin: '0 0 12px', fontSize: '.86rem', lineHeight: 1.55 }}>
					{tr.foodSecAnglesHint}
				</p>
				{angleBullets.length === 0 ? (
					<p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>{tr.foodSecAnglesEmpty}</p>
				) : (
					<ul className="muted" style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.58, fontSize: '.9rem' }}>
						{angleBullets.map((line, idx) => (
							<li key={idx} style={{ marginBottom: 8 }}>
								{line}
							</li>
						))}
					</ul>
				)}
			</div>

			<div
				className="contact-panel"
				style={{
					marginTop: 18,
					borderColor: 'rgba(124, 205, 156, 0.28)',
					background: 'rgba(124, 205, 156, 0.05)',
				}}>
				<h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>{tr.foodSecHypothesisTitle}</h3>
				<p className="muted" style={{ margin: '0 0 10px', fontSize: '.84rem', lineHeight: 1.55 }}>
					{tr.foodSecHypothesisHint}
				</p>
				<textarea
					className="muted"
					value={hypothesis}
					onChange={e => setHypothesis(e.target.value)}
					placeholder={tr.foodSecHypothesisPlaceholder}
					rows={5}
					style={{
						width: '100%',
						boxSizing: 'border-box',
						padding: 12,
						borderRadius: 8,
						border: '1px solid rgba(148,163,184,0.25)',
						background: 'rgba(15,23,42,0.35)',
						color: '#e2e8f0',
						fontSize: '.9rem',
						lineHeight: 1.5,
						resize: 'vertical',
					}}
				/>
				<p className="muted" style={{ margin: '10px 0 0', fontSize: '.78rem' }}>
					{tr.foodSecHypothesisFooter}
				</p>
			</div>

			<p
				className="muted"
				style={{
					marginTop: 16,
					fontSize: '.85rem',
					padding: '12px 14px',
					borderRadius: 8,
					background: 'rgba(56, 189, 248, 0.06)',
					border: '1px solid rgba(56, 189, 248, 0.22)',
					lineHeight: 1.55,
				}}>
				{tr.foodSecDisclaimer}
			</p>
		</section>
	);
}
