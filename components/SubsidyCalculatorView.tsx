import { useEffect, useMemo, useState } from 'react';
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
import { DfzOfficialPdfPack } from './DfzOfficialPdfPack';

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
	initialFocus?: FarmProductionFocus | null;
	initialMarketQuery?: string;
	onOpenMarketWithQuery?: (query: string) => void;
};

export function SubsidyCalculatorView({
	lang,
	tr,
	onOpenCalendar,
	initialFocus,
	initialMarketQuery,
	onOpenMarketWithQuery,
}: Props) {
	const [decares, setDecares] = useState('50');
	const [focus, setFocus] = useState<FarmProductionFocus>('grain');
	const [organicEco, setOrganicEco] = useState(false);
	const [youngFarmer, setYoungFarmer] = useState(false);
	const [dairyCows, setDairyCows] = useState('');
	const [candidateAge, setCandidateAge] = useState('28');
	const [currentSpo, setCurrentSpo] = useState('5200');
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (initialFocus) setFocus(initialFocus);
	}, [initialFocus]);

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

	const t2 = (bg: string, en: string) => (lang === 'bg' ? bg : en);
	const preAge = Number(String(candidateAge).replace(',', '.'));
	const preSpo = Number(String(currentSpo).replace(',', '.'));
	const ageValid = Number.isFinite(preAge) && preAge >= 18 && preAge <= 90;
	const spoValid = Number.isFinite(preSpo) && preSpo >= 0;
	const fitYoung = ageValid && preSpo >= 8000 && preSpo <= 20000 && preAge <= 40;
	const fitSmall = ageValid && preSpo >= 2000 && preSpo < 8000;
	const prescreenRecommendation = !ageValid || !spoValid
		? t2(
				'Въведи валидни възраст и СПО за препоръка.',
				'Enter valid age and SO values for recommendation.'
			)
		: fitYoung
			? t2(
					'По въведените данни си по-близо до II.Д.1 „Млад фермер“ (ориентир).',
					'Based on your inputs, you are closer to II.D.1 Young Farmer (indicative).'
				)
			: fitSmall
				? t2(
						'По въведените данни си по-близо до II.Д.2 „Малки стопанства“ (ориентир).',
						'Based on your inputs, you are closer to II.D.2 Small Farms (indicative).'
					)
				: t2(
						'Въведеното СПО е извън типичните диапазони II.Д.1/II.Д.2 — провери инвестиционни интервенции.',
						'Your SO is outside the typical II.D.1/II.D.2 ranges — check investment interventions.'
					);

	const docChecklist = [
		t2('Регистрация като ЗП и актуални данни в регистъра', 'Registered farmer status and current registry data'),
		t2('Правно основание за земя/обекти за целия период', 'Legal tenure for land/assets covering the period'),
		t2('Актуално СПО изчисление по таблица МЗХ', 'Current SO calculation using MA tables'),
		t2('Оферти/инвестиционен план с реални пазарни цени', 'Quotes/investment plan with realistic market prices'),
	];
	const commonErrors = [
		t2('СПО е сметнато със стари ставки', 'SO calculated with outdated coefficients'),
		t2('Договорите за земя изтичат преди срока на плана', 'Land contracts expire before plan horizon'),
		t2('Нереалистични приходи без пазарно обосноваване', 'Unrealistic revenues without market grounding'),
		t2('Липсва ясно как ще се постигне ръстът на СПО', 'No clear path on how SO growth is achieved'),
	];
	const marketQueryForFocus = useMemo(() => {
		if (initialMarketQuery?.trim()) return initialMarketQuery.trim();
		switch (focus) {
			case 'grain':
				return lang === 'bg' ? 'пшеница' : 'wheat';
			case 'horticulture':
				return lang === 'bg' ? 'зеленчуци' : 'vegetables';
			case 'vine':
				return lang === 'bg' ? 'грозде' : 'grape';
			case 'livestock':
				return lang === 'bg' ? 'животновъдство' : 'livestock';
			default:
				return lang === 'bg' ? 'земеделие' : 'agri';
		}
	}, [focus, initialMarketQuery, lang]);

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
					<Calculator size={24} color="#7ccd9c" aria-hidden />
					{tr.subsidyCalcTitle}
				</h2>
				<button type="button" className="btn btn-outline" onClick={onOpenCalendar}>
					{tr.subsidyCalcGoCalendar}
				</button>
				{onOpenMarketWithQuery ? (
					<button
						type="button"
						className="btn btn-outline"
						onClick={() => onOpenMarketWithQuery(marketQueryForFocus)}>
						{lang === 'bg' ? 'Покажи оферти в Пазар' : 'Show offers in Market'}
					</button>
				) : null}
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.subsidyCalcSubtitle}
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
							background: 'var(--panel, #141f18)',
							color: 'var(--text, #f4faf7)',
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
								background: 'var(--panel, #141f18)',
								color: 'var(--text, #f4faf7)',
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

				<div
					className="contact-panel"
					style={{
						marginTop: 0,
						marginBottom: 18,
						borderColor: 'rgba(124,205,156,0.35)',
						background: 'linear-gradient(165deg, rgba(124,205,156,0.09) 0%, rgba(12,22,17,0.42) 100%)',
					}}>
					<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>
						{t2('Коя мярка е за мен: II.Д.1 vs II.Д.2', 'Which measure fits me: II.D.1 vs II.D.2')}
					</h3>
					<p className="muted" style={{ margin: '0 0 10px', fontSize: '.9rem' }}>
						{t2(
							'Бърз pre-screen по възраст и СПО (ориентир, не официално становище).',
							'Quick pre-screen by age and SO (indicative, not an official ruling).'
						)}
					</p>
					<div
						className="form-grid"
						style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 10 }}>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{t2('Възраст', 'Age')}
							</span>
							<input
								type="number"
								min={18}
								max={90}
								value={candidateAge}
								onChange={e => setCandidateAge(e.target.value)}
							/>
						</label>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span className="muted" style={{ fontSize: '.85rem' }}>
								{t2('Текущ СПО (€)', 'Current SO (€)')}
							</span>
							<input
								type="number"
								min={0}
								step={100}
								value={currentSpo}
								onChange={e => setCurrentSpo(e.target.value)}
							/>
						</label>
					</div>
					<p style={{ margin: '0 0 10px', fontWeight: 700, color: '#cbd5e1' }}>{prescreenRecommendation}</p>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
						<div>
							<p className="muted" style={{ margin: '0 0 6px', fontSize: '.85rem' }}>
								{t2('Чеклист документи', 'Document checklist')}
							</p>
							<ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem' }}>
								{docChecklist.map(item => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
						<div>
							<p className="muted" style={{ margin: '0 0 6px', fontSize: '.85rem' }}>
								{t2('Чести грешки', 'Common mistakes')}
							</p>
							<ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem' }}>
								{commonErrors.map(item => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					</div>
					<div style={{ marginTop: 12 }}>
						<p className="muted" style={{ margin: '0 0 6px', fontSize: '.85rem' }}>
							{t2('Сравнение II.Д.1 vs II.Д.2', 'II.D.1 vs II.D.2 comparison')}
						</p>
						<div className="table-shell">
						<table className="data-table" style={{ minWidth: 520 }}>
							<thead>
								<tr>
									<th>
										{t2('Параметър', 'Parameter')}
									</th>
									<th>
										II.Д.1
									</th>
									<th>
										II.Д.2
									</th>
								</tr>
							</thead>
							<tbody>
								{[
								[
									t2('СПО диапазон', 'SO range'),
									t2('8 000–20 000 €', '8,000–20,000 EUR'),
									t2('2 000–7 999 €', '2,000–7,999 EUR'),
								],
								[
									t2('Размер помощ', 'Grant size'),
									t2('до 40 000 €', 'up to 40,000 EUR'),
									t2('до 15 000 €', 'up to 15,000 EUR'),
								],
								[
									t2('Срок изпълнение', 'Implementation term'),
									t2('до 4 г.', 'up to 4 years'),
									t2('до 3 г.', 'up to 3 years'),
								],
								[
									t2('Изискване ръст СПО', 'SO growth requirement'),
									t2('планов ръст (по бизнес план)', 'planned growth (per business plan)'),
									t2('мин. +2 000 €', 'min. +2,000 EUR'),
								],
								[
									t2('Възраст', 'Age'),
									t2('до 40 г.', 'up to 40 years'),
									t2('18+ (без горна граница)', '18+ (no upper limit)'),
								],
								].map((row, idx) => (
									<tr key={row[0]} style={{ background: idx % 2 ? 'rgba(15,23,42,0.08)' : 'transparent' }}>
										<td>{row[0]}</td>
										<td>{row[1]}</td>
										<td>{row[2]}</td>
									</tr>
								))}
							</tbody>
						</table>
						</div>
					</div>
				</div>
			</div>

			<DfzOfficialPdfPack tr={tr} />
		</section>
	);
}

function localeForLang(lang: UiLang): string {
	return lang === 'en' ? 'en-GB' : 'bg-BG';
}
