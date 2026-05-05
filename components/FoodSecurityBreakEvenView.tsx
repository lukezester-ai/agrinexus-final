import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';

type Props = {
	lang: UiLang;
	tr: AppStrings;
};

export function FoodSecurityBreakEvenView({ lang, tr }: Props) {
	const [population, setPopulation] = useState(250_000);
	const [kgPerCapitaYear, setKgPerCapitaYear] = useState(180);
	const [manualSupplyTonnes, setManualSupplyTonnes] = useState(45_000);
	const [yieldTPerHa, setYieldTPerHa] = useState(4);
	const [variableCostEurPerHa, setVariableCostEurPerHa] = useState(520);
	const [fixedProgrammeEur, setFixedProgrammeEur] = useState(2_500_000);
	const [referencePriceEurPerT, setReferencePriceEurPerT] = useState(230);

	const derived = useMemo(() => {
		const usePop = population > 0;
		const supplyTonnes = usePop ? (population * kgPerCapitaYear) / 1000 : Math.max(0, manualSupplyTonnes);
		const ha = yieldTPerHa > 0 ? supplyTonnes / yieldTPerHa : 0;
		const totalCost = Math.max(0, fixedProgrammeEur) + ha * Math.max(0, variableCostEurPerHa);
		const breakEvenPrice = supplyTonnes > 0 ? totalCost / supplyTonnes : 0;
		const revenue = supplyTonnes * Math.max(0, referencePriceEurPerT);
		const marginTotal = revenue - totalCost;
		const marginPerT = supplyTonnes > 0 ? marginTotal / supplyTonnes : 0;
		const breakEvenYieldAtRef =
			ha > 0 && referencePriceEurPerT > 0 ? totalCost / (ha * referencePriceEurPerT) : 0;
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
	}, [
		population,
		kgPerCapitaYear,
		manualSupplyTonnes,
		yieldTPerHa,
		variableCostEurPerHa,
		fixedProgrammeEur,
		referencePriceEurPerT,
	]);

	const marginPositive = derived.marginTotal >= 0;
	const statusLine = marginPositive
		? tr.foodSecMarginTotalProfit.replace('{eur}', String(Math.round(derived.marginTotal)))
		: tr.foodSecMarginTotalLoss.replace('{eur}', String(Math.round(Math.abs(derived.marginTotal))));

	return (
		<section className="section">
			<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
				<Shield size={26} color="#7ccd9c" aria-hidden />
				{tr.foodSecTitle}
			</h2>
			<p className="muted" style={{ marginTop: 10, lineHeight: 1.58 }}>
				{tr.foodSecSubtitle}
			</p>

			<div
				className="contact-panel"
				style={{
					marginTop: 18,
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
							value={population || ''}
							onChange={e => setPopulation(Math.max(0, Number(e.target.value) || 0))}
							placeholder="0"
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecKgPerCapita}
						<input
							type="number"
							min={0}
							step={10}
							value={kgPerCapitaYear}
							onChange={e => setKgPerCapitaYear(Math.max(0, Number(e.target.value) || 0))}
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
							onChange={e => setManualSupplyTonnes(Math.max(0, Number(e.target.value) || 0))}
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
							onChange={e => setYieldTPerHa(Math.max(0, Number(e.target.value) || 0))}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecVarCostHa}
						<input
							type="number"
							min={0}
							step={10}
							value={variableCostEurPerHa}
							onChange={e => setVariableCostEurPerHa(Math.max(0, Number(e.target.value) || 0))}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecFixedProgramme}
						<input
							type="number"
							min={0}
							step={10000}
							value={fixedProgrammeEur}
							onChange={e => setFixedProgrammeEur(Math.max(0, Number(e.target.value) || 0))}
						/>
					</label>
					<label className="muted" style={{ display: 'grid', gap: 6, fontSize: '.86rem' }}>
						{tr.foodSecReferencePrice}
						<input
							type="number"
							min={0}
							step={1}
							value={referencePriceEurPerT}
							onChange={e => setReferencePriceEurPerT(Math.max(0, Number(e.target.value) || 0))}
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
						{`${derived.supplyTonnes.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB', { maximumFractionDigits: 0 })} t`}
						{derived.usePop ? ` (${tr.foodSecFromPopulation})` : ` (${tr.foodSecManualMode})`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecLandHa}</strong> {`${derived.ha.toFixed(1)} ha`}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
						<strong>{tr.foodSecTotalCost}</strong>{' '}
						{`${Math.round(derived.totalCost).toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB')} EUR`}
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
