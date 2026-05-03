import { useMemo, useState } from 'react';
import { Calculator, Check, Copy } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	estimateSubsidy,
	formatShareSnippet,
	validateCalculatorInput,
	type FarmProductionFocus,
	type SubsidyCalculatorInput,
	type SubsidyCalcErrorCode,
} from '../lib/subsidy-calculator';

const FOCUS_IDS: FarmProductionFocus[] = ['grain', 'mixed', 'horticulture', 'vine', 'livestock'];

function focusLabel(tr: AppStrings, id: FarmProductionFocus): string {
	switch (id) {
		case 'grain':
			return tr.subsidyFocusGrain;
		case 'mixed':
			return tr.subsidyFocusMixed;
		case 'horticulture':
			return tr.subsidyFocusHorticulture;
		case 'vine':
			return tr.subsidyFocusVine;
		case 'livestock':
			return tr.subsidyFocusLivestock;
	}
}

function errText(tr: AppStrings, code: SubsidyCalcErrorCode): string {
	switch (code) {
		case 'DECARES_MIN':
			return tr.subsidyErrDecaresMin;
		case 'DECARES_MAX':
			return tr.subsidyErrDecaresMax;
		case 'COWS_RANGE':
			return tr.subsidyErrCows;
		case 'COWS_MAX':
			return tr.subsidyErrCowsMax;
	}
}

type Props = {
	lang: UiLang;
	tr: AppStrings;
	onOpenCalendar: () => void;
};

export function SubsidyCalculatorView({ lang, tr, onOpenCalendar }: Props) {
	const [decares, setDecares] = useState('50');
	const [focus, setFocus] = useState<FarmProductionFocus>('grain');
	const [organicEco, setOrganicEco] = useState(false);
	const [youngFarmer, setYoungFarmer] = useState(false);
	const [dairyCows, setDairyCows] = useState('');
	const [copied, setCopied] = useState(false);

	const input = useMemo((): SubsidyCalculatorInput => {
		const d = Number(String(decares).replace(',', '.'));
		const cowRaw = dairyCows.trim();
		const cowNum = cowRaw === '' ? undefined : Number(cowRaw);
		const cows = cowNum !== undefined && Number.isFinite(cowNum) ? cowNum : undefined;
		return {
			decares: Number.isFinite(d) ? d : 0,
			focus,
			organicEco,
			youngFarmer,
			dairyCows: cows,
		};
	}, [decares, focus, organicEco, youngFarmer, dairyCows]);

	const validationCode = useMemo(() => validateCalculatorInput(input), [input]);
	const result = useMemo(() => {
		if (validationCode) return null;
		return estimateSubsidy(input, lang);
	}, [input, validationCode, lang]);

	const siteUrl =
		(typeof import.meta !== 'undefined' && String(import.meta.env?.VITE_SITE_URL ?? '').trim()) ||
		(typeof window !== 'undefined' ? window.location.origin : '');

	const onShare = async () => {
		if (!result) return;
		const text = formatShareSnippet(
			input.decares,
			result.totalLowBgn,
			result.totalHighBgn,
			siteUrl || 'https://agrinexus.eu',
			lang,
		);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		} catch {
			window.prompt('Copy:', text);
		}
	};

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
					<Calculator size={24} color="#5dbd9a" aria-hidden />
					{tr.subsidyCalcTitle}
				</h2>
				<button type="button" className="btn btn-outline" onClick={onOpenCalendar}>
					{tr.subsidyCalcGoCalendar}
				</button>
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.subsidyCalcSubtitle}
			</p>

			<div className="contact-panel" style={{ maxWidth: 520 }}>
				<div style={{ marginBottom: 16 }}>
					<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
						{tr.subsidyCalcDecares}
					</label>
					<input
						type="number"
						min={0.5}
						step={0.5}
						value={decares}
						onChange={e => setDecares(e.target.value)}
						style={{
							width: '100%',
							padding: '12px 14px',
							borderRadius: 8,
							border: '1px solid var(--border, #334155)',
							background: 'var(--panel, #0f172a)',
							color: 'var(--text, #e2e8f0)',
							fontSize: '1.05rem',
						}}
					/>
					<span className="muted" style={{ fontSize: '.8rem' }}>
						{tr.subsidyCalcDecaresHint}
					</span>
				</div>

				<div style={{ marginBottom: 16 }}>
					<span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '.9rem' }}>
						{tr.subsidyCalcFocus}
					</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						{FOCUS_IDS.map(id => (
							<button
								key={id}
								type="button"
								className={focus === id ? 'btn btn-primary' : 'btn btn-outline'}
								style={{ justifyContent: 'flex-start', textAlign: 'inherit' }}
								onClick={() => setFocus(id)}>
								{focusLabel(tr, id)}
							</button>
						))}
					</div>
				</div>

				{focus === 'livestock' && (
					<div style={{ marginBottom: 16 }}>
						<label className="muted" style={{ display: 'block', marginBottom: 6, fontSize: '.9rem' }}>
							{tr.subsidyCalcDairyCows}
						</label>
						<input
							type="number"
							min={0}
							value={dairyCows}
							onChange={e => setDairyCows(e.target.value)}
							placeholder={tr.subsidyCalcDairyPlaceholder}
							style={{
								width: '100%',
								padding: '12px 14px',
								borderRadius: 8,
								border: '1px solid var(--border, #334155)',
								background: 'var(--panel, #0f172a)',
								color: 'var(--text, #e2e8f0)',
							}}
						/>
					</div>
				)}

				<label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={youngFarmer}
						onChange={e => setYoungFarmer(e.target.checked)}
					/>
					<span style={{ fontSize: '.9rem' }}>{tr.subsidyCalcYoungFarmer}</span>
				</label>
				<label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={organicEco}
						onChange={e => setOrganicEco(e.target.checked)}
					/>
					<span style={{ fontSize: '.9rem' }}>{tr.subsidyCalcOrganic}</span>
				</label>

				{validationCode ? (
					<p style={{ color: '#f87171', margin: '8px 0 0', fontSize: '.9rem' }}>
						{errText(tr, validationCode)}
					</p>
				) : result ? (
					<div style={{ marginTop: 8 }}>
						<p style={{ margin: '0 0 8px', fontWeight: 600 }}>
							{tr.subsidyCalcTotalRange}: {result.totalLowBgn.toLocaleString(localeForLang(lang))}–
							{result.totalHighBgn.toLocaleString(localeForLang(lang))} {tr.subsidyCalcPerYear}
						</p>
						<ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: '.88rem' }} className="muted">
							{result.lines.map((line, i) => (
								<li key={i} style={{ marginBottom: 4 }}>
									{line.label}
									{line.lowBgn > 0 || line.highBgn > 0
										? ` — ${line.lowBgn.toLocaleString(localeForLang(lang))}–${line.highBgn.toLocaleString(localeForLang(lang))}`
										: ''}
								</li>
							))}
						</ul>
						<button type="button" className="btn btn-outline" onClick={onShare}>
							{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
							{copied ? tr.subsidyCalcCopied : tr.subsidyCalcCopy}
						</button>
					</div>
				) : null}

				<p className="muted" style={{ marginTop: 16, fontSize: '.82rem', marginBottom: 0 }}>
					{tr.subsidyCalcDisclaimer}
				</p>
			</div>
		</section>
	);
}

function localeForLang(lang: UiLang): string {
	if (lang === 'ar') return 'ar-BG';
	if (lang === 'en') return 'en-GB';
	return 'bg-BG';
}
