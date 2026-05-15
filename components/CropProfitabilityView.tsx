import { useEffect, useMemo, useState, type InputHTMLAttributes } from 'react';
import { Check, Copy, TrendingUp } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	CROP_PRESETS,
	estimateCropProfitability,
	formatCropProfitShareSnippet,
	validateCropProfitabilityInput,
	type CropPresetId,
	type CropProfitabilityInput,
	type CropProfitErrorCode,
} from '../lib/crop-profitability-calculator';

const PRESET_IDS: CropPresetId[] = ['wheat', 'sunflower', 'corn', 'barley'];

function presetLabel(tr: AppStrings, id: CropPresetId): string {
	switch (id) {
		case 'wheat':
			return tr.cropProfitPresetWheat;
		case 'sunflower':
			return tr.cropProfitPresetSunflower;
		case 'corn':
			return tr.cropProfitPresetCorn;
		case 'barley':
			return tr.cropProfitPresetBarley;
		default:
			return tr.cropProfitPresetCustom;
	}
}

function errText(tr: AppStrings, code: CropProfitErrorCode): string {
	switch (code) {
		case 'DECARES_MIN':
			return tr.cropProfitErrDecaresMin;
		case 'DECARES_MAX':
			return tr.cropProfitErrDecaresMax;
		case 'YIELD_MIN':
			return tr.cropProfitErrYield;
		case 'PRICE_MIN':
			return tr.cropProfitErrPrice;
		case 'COST_NEGATIVE':
			return tr.cropProfitErrCost;
	}
}

function localeForLang(lang: UiLang): string {
	return lang === 'en' ? 'en-GB' : 'bg-BG';
}

function numInput(value: string, onChange: (v: string) => void, props: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			type="number"
			value={value}
			onChange={e => onChange(e.target.value)}
			style={{
				width: '100%',
				padding: '12px 14px',
				borderRadius: 8,
				border: '1px solid var(--border, #334155)',
				background: 'var(--panel, #141f18)',
				color: 'var(--text, #f4faf7)',
				fontSize: '1.05rem',
			}}
			{...props}
		/>
	);
}

type Props = {
	lang: UiLang;
	tr: AppStrings;
	onOpenFieldlot?: () => void;
};

export function CropProfitabilityView({ lang, tr, onOpenFieldlot }: Props) {
	const [preset, setPreset] = useState<CropPresetId>('wheat');
	const [decares, setDecares] = useState('100');
	const [yieldKg, setYieldKg] = useState(String(CROP_PRESETS.wheat.yieldKgPerDecare));
	const [priceT, setPriceT] = useState(String(CROP_PRESETS.wheat.priceBgnPerTonne));
	const [costDka, setCostDka] = useState(String(CROP_PRESETS.wheat.variableCostBgnPerDecare));
	const [fixedCost, setFixedCost] = useState('0');
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (preset === 'custom') return;
		const p = CROP_PRESETS[preset];
		setYieldKg(String(p.yieldKgPerDecare));
		setPriceT(String(p.priceBgnPerTonne));
		setCostDka(String(p.variableCostBgnPerDecare));
	}, [preset]);

	const input = useMemo((): CropProfitabilityInput => {
		const parse = (s: string) => Number(String(s).replace(',', '.'));
		return {
			decares: parse(decares),
			yieldKgPerDecare: parse(yieldKg),
			priceBgnPerTonne: parse(priceT),
			variableCostBgnPerDecare: parse(costDka),
			fixedCostBgn: parse(fixedCost) || 0,
		};
	}, [decares, yieldKg, priceT, costDka, fixedCost]);

	const validationCode = useMemo(() => validateCropProfitabilityInput(input), [input]);
	const result = useMemo(() => {
		if (validationCode) return null;
		return estimateCropProfitability(input);
	}, [input, validationCode]);

	const siteUrl =
		(typeof import.meta !== 'undefined' && String(import.meta.env?.VITE_SITE_URL ?? '').trim()) ||
		(typeof window !== 'undefined' ? window.location.origin : '');

	const loc = localeForLang(lang);
	const fmt = (n: number) => n.toLocaleString(loc);

	const onShare = async () => {
		if (!result) return;
		const text = formatCropProfitShareSnippet(input, result, siteUrl || 'https://agrinexus.eu.com', lang);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		} catch {
			window.prompt('Copy:', text);
		}
	};

	const marginColor =
		result && result.marginPerDecareBgn >= 0 ? 'var(--accent, #7ccd9c)' : '#f87171';

	return (
		<section className="section">
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
					marginBottom: 20,
				}}>
				<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
					<TrendingUp size={24} color="#7ccd9c" aria-hidden />
					{tr.cropProfitTitle}
				</h2>
				{onOpenFieldlot ? (
					<button type="button" className="btn btn-outline" onClick={onOpenFieldlot}>
						{tr.cropProfitGoFieldlot}
					</button>
				) : (
					<a className="btn btn-outline" href="/fieldlot.html">
						{tr.cropProfitGoFieldlot}
					</a>
				)}
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.cropProfitSubtitle}
			</p>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
					gap: 14,
					alignItems: 'start',
				}}>
				<div className="contact-panel" style={{ marginTop: 0 }}>
					<div style={{ marginBottom: 16 }}>
						<span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '.9rem' }}>
							{tr.cropProfitPreset}
						</span>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
							{PRESET_IDS.map(id => (
								<button
									key={id}
									type="button"
									className={preset === id ? 'btn btn-primary' : 'btn btn-outline'}
									onClick={() => setPreset(id)}>
									{presetLabel(tr, id)}
								</button>
							))}
						</div>
					</div>

					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.cropProfitDecares}
						</label>
						{numInput(decares, setDecares, { min: 0.5, step: 0.5 })}
						<span className="muted" style={{ fontSize: '.8rem' }}>
							{tr.cropProfitDecaresHint}
						</span>
					</div>

					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.cropProfitYield}
						</label>
						{numInput(yieldKg, setYieldKg, { min: 0, step: 0.5, onFocus: () => setPreset('custom') })}
					</div>

					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.cropProfitPrice}
						</label>
						{numInput(priceT, setPriceT, { min: 0, step: 1, onFocus: () => setPreset('custom') })}
					</div>

					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.cropProfitCostDka}
						</label>
						{numInput(costDka, setCostDka, { min: 0, step: 1, onFocus: () => setPreset('custom') })}
					</div>

					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.cropProfitFixed}
						</label>
						{numInput(fixedCost, setFixedCost, { min: 0, step: 100 })}
						<span className="muted" style={{ fontSize: '.8rem' }}>
							{tr.cropProfitFixedHint}
						</span>
					</div>

					{validationCode ? (
						<p style={{ color: '#f87171', margin: '8px 0 0', fontSize: '.9rem' }}>
							{errText(tr, validationCode)}
						</p>
					) : null}
				</div>

				<div
					className="contact-panel"
					style={{
						marginTop: 0,
						borderColor: 'rgba(124,205,156,0.35)',
						background: 'linear-gradient(165deg, rgba(124,205,156,0.09) 0%, rgba(12,22,17,0.42) 100%)',
					}}>
					{result ? (
						<>
							<p style={{ margin: '0 0 4px', fontSize: '.88rem' }} className="muted">
								{tr.cropProfitMarginDecare}
							</p>
							<p style={{ margin: '0 0 16px', fontSize: '1.75rem', fontWeight: 700, color: marginColor }}>
								{fmt(result.marginPerDecareBgn)} {tr.cropProfitBgnPerDecare}
							</p>
							<ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: '.88rem' }} className="muted">
								<li>
									{tr.cropProfitMarginTotal}: {fmt(result.marginTotalBgn)} {tr.cropProfitBgn}
								</li>
								<li>
									{tr.cropProfitMarginHa}: {fmt(result.marginPerHectareBgn)} {tr.cropProfitBgnPerHa}
								</li>
								<li>
									{tr.cropProfitRevenue}: {fmt(result.revenueBgn)} {tr.cropProfitBgn}
								</li>
								<li>
									{tr.cropProfitCosts}: {fmt(result.totalCostsBgn)} {tr.cropProfitBgn}
								</li>
								<li>
									{tr.cropProfitYieldTotal}: {result.totalYieldTonnes.toFixed(2)} {tr.cropProfitTonnes}
								</li>
								{result.breakEvenYieldKgPerDecare != null ? (
									<li>
										{tr.cropProfitBreakEvenYield}: {result.breakEvenYieldKgPerDecare}{' '}
										{tr.cropProfitKgPerDecare}
									</li>
								) : null}
								{result.breakEvenPriceBgnPerTonne != null ? (
									<li>
										{tr.cropProfitBreakEvenPrice}: {fmt(result.breakEvenPriceBgnPerTonne)}{' '}
										{tr.cropProfitBgnPerT}
									</li>
								) : null}
							</ul>
							<button type="button" className="btn btn-outline" onClick={onShare}>
								{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
								{copied ? tr.cropProfitCopied : tr.cropProfitCopy}
							</button>
						</>
					) : (
						<p className="muted" style={{ margin: 0 }}>
							{tr.cropProfitFillFields}
						</p>
					)}
					<p className="muted" style={{ marginTop: 16, fontSize: '.82rem', marginBottom: 0 }}>
						{tr.cropProfitDisclaimer}
					</p>
				</div>
			</div>
		</section>
	);
}
