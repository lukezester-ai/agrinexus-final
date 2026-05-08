import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	CROP_ORDER,
	DFZ_FIXED_DEADLINES,
	MONTH_NAMES_BG,
	SEASON_TASKS_BY_CROP,
	type CropCalendarKey,
} from '../lib/season-calendar-data';
import { resolveSeasonVisual } from '../lib/season-calendar-visuals';
import { SeasonMonthArtBanner } from './season-calendar-month-art';

const CROP_EMOJI: Record<CropCalendarKey, string> = {
	wheat_barley: '🌾',
	sunflower: '🌻',
	maize: '🌽',
	vine: '🍇',
	apple: '🍎',
};

function cropLabel(tr: AppStrings, key: CropCalendarKey): string {
	switch (key) {
		case 'wheat_barley':
			return tr.seasonCropWheatBarley;
		case 'sunflower':
			return tr.seasonCropSunflower;
		case 'maize':
			return tr.seasonCropMaize;
		case 'vine':
			return tr.seasonCropVine;
		case 'apple':
			return tr.seasonCropApple;
	}
}

function monthLabel(tr: AppStrings, monthIndex0: number): string {
	const keys = [
		tr.seasonMo1,
		tr.seasonMo2,
		tr.seasonMo3,
		tr.seasonMo4,
		tr.seasonMo5,
		tr.seasonMo6,
		tr.seasonMo7,
		tr.seasonMo8,
		tr.seasonMo9,
		tr.seasonMo10,
		tr.seasonMo11,
		tr.seasonMo12,
	] as const;
	return keys[monthIndex0];
}

type Props = {
	lang: UiLang;
	tr: AppStrings;
	onOpenSubsidy: () => void;
};

export function SeasonCalendarView({ lang, tr, onOpenSubsidy }: Props) {
	const [crop, setCrop] = useState<CropCalendarKey>('wheat_barley');
	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;
	const selectedYear = currentYear;
	const selectedMonth = currentMonth;
	const [ragLoading, setRagLoading] = useState(false);
	const [ragError, setRagError] = useState('');
	const [ragAnswer, setRagAnswer] = useState('');
	const [ragTasksByMonth, setRagTasksByMonth] = useState<Record<number, string[]>>({});
	const tasksByMonth = useMemo(() => SEASON_TASKS_BY_CROP[crop], [crop]);
	const showBgNote = lang !== 'bg' && tr.seasonCalendarBgNote.length > 0;
	const selectedMonthTasks = tasksByMonth[selectedMonth] ?? [];

	const askRagForMonthPlan = async () => {
		if (ragLoading) return;
		setRagError('');
		setRagLoading(true);
		try {
			const cropName = cropLabel(tr, crop);
			const monthName = monthLabel(tr, selectedMonth - 1);
			const contextList = selectedMonthTasks.length > 0 ? selectedMonthTasks.map(t => `- ${t}`).join('\n') : '-';
			const userPrompt =
				lang === 'bg'
					? `Ти си агроном-оператор. Направи кратък оперативен план за ${cropName} за ${monthName} ${selectedYear} в 5-7 точки.\nИзползвай контекст от календара:\n${contextList}\n\nВърни само списък с кратки точки, по една на ред, без допълнителни обяснения.`
					: `You are an agronomy operations planner. Build a concise action plan for ${cropName} for ${monthName} ${selectedYear} in 5-7 bullets.\nUse this season-calendar context:\n${contextList}\n\nReturn only bullet-like lines, one per row, no extra explanation.`;
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [{ role: 'user', content: userPrompt }],
					locale: lang,
					persona: 'finance',
				}),
			});
			const data = (await res.json()) as { reply?: string; error?: string };
			if (!res.ok) throw new Error(data.error || 'RAG request failed');
			const reply = (data.reply || '').trim();
			setRagAnswer(reply);
			const parsed = reply
				.split('\n')
				.map(line => line.replace(/^[-*•\d.\s]+/, '').trim())
				.filter(Boolean)
				.slice(0, 10);
			setRagTasksByMonth(prev => ({ ...prev, [selectedMonth]: parsed }));
		} catch (e) {
			setRagError(e instanceof Error ? e.message : 'RAG request failed');
		} finally {
			setRagLoading(false);
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
					<CalendarDays size={24} color="#7ccd9c" aria-hidden />
					{tr.seasonCalendarTitle}
				</h2>
				<button type="button" className="btn btn-outline" onClick={onOpenSubsidy}>
					{tr.seasonCalendarGoSubsidy}
				</button>
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.seasonCalendarSubtitle}
			</p>

			{showBgNote ? (
				<p
					style={{
						fontSize: '.85rem',
						padding: '10px 12px',
						borderRadius: 8,
						background: 'rgba(124, 205, 156, 0.08)',
						border: '1px solid rgba(124, 205, 156, 0.28)',
						marginBottom: 16,
					}}>
					{tr.seasonCalendarBgNote}
				</p>
			) : null}

			<div style={{ marginBottom: 20 }}>
				<span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '.9rem' }}>
					{tr.seasonCalendarPickCrop}
				</span>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{CROP_ORDER.map(k => (
						<button
							key={k}
							type="button"
							className={`season-cal-crop-btn ${crop === k ? 'btn btn-primary' : 'btn btn-outline'}`}
							onClick={() => setCrop(k)}
							style={{ flex: '1 1 180px', justifyContent: 'center' }}>
							<span style={{ fontSize: '1.15rem', lineHeight: 1 }} aria-hidden>
								{CROP_EMOJI[k]}
							</span>
							{cropLabel(tr, k)}
						</button>
					))}
				</div>
			</div>

			<div
				className="contact-panel"
				style={{
					marginBottom: 24,
					borderColor: 'rgba(124, 205, 156, 0.28)',
					background: 'rgba(16, 31, 22, 0.52)',
				}}>
				<p style={{ margin: '0 0 10px', fontSize: '.75rem', fontWeight: 700, letterSpacing: '0.04em' }}>
					{tr.seasonCalendarDfzTitle}
				</p>
				<ul style={{ margin: 0, paddingLeft: 18, fontSize: '.88rem' }} className="muted">
					{DFZ_FIXED_DEADLINES.map((d, i) => (
						<li key={i} style={{ marginBottom: 6 }}>
							<strong>
								{d.day} {MONTH_NAMES_BG[d.month - 1]} {selectedYear}
							</strong>
							{' — '}
							{d.title}
						</li>
					))}
				</ul>
			</div>

			<p className="muted" style={{ marginTop: 0, marginBottom: 20, fontSize: '.84rem', lineHeight: 1.55 }}>
				{tr.seasonCalendarDfzPdfHint}
			</p>

			<div
				className="contact-panel"
				style={{
					marginBottom: 20,
					borderColor: 'rgba(124, 205, 156, 0.35)',
					background: 'rgba(16, 31, 22, 0.6)',
				}}>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						gap: 8,
						alignItems: 'center',
						flexWrap: 'wrap',
					}}>
					<div>
						<p style={{ margin: 0, fontSize: '.9rem', fontWeight: 700 }}>
							{lang === 'bg' ? 'RAG управление на календар' : 'RAG calendar control'}
						</p>
						<p className="muted" style={{ margin: '6px 0 0', fontSize: '.82rem' }}>
							{lang === 'bg'
								? `Генерира AI план за ${monthLabel(tr, selectedMonth - 1)} ${selectedYear} и го добавя към месеца.`
								: `Generates an AI plan for ${monthLabel(tr, selectedMonth - 1)} ${selectedYear} and injects it into that month.`}
						</p>
					</div>
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => void askRagForMonthPlan()}
						disabled={ragLoading}
						style={{ flex: '1 1 240px' }}>
						{ragLoading ? (lang === 'bg' ? 'Генерирам...' : 'Generating...') : lang === 'bg' ? 'RAG план за месеца' : 'RAG month plan'}
					</button>
				</div>
				{ragError ? (
					<p style={{ marginTop: 10, color: '#f87171', fontSize: '.82rem' }}>{ragError}</p>
				) : null}
				{ragAnswer ? (
					<pre
						style={{
							marginTop: 10,
							whiteSpace: 'pre-wrap',
							overflowWrap: 'anywhere',
							fontFamily: 'inherit',
							fontSize: '.82rem',
							background: 'rgba(10, 20, 14, 0.55)',
							border: '1px solid rgba(124, 205, 156, 0.24)',
							borderRadius: 8,
							padding: 10,
						}}>
						{ragAnswer}
					</pre>
				) : null}
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
					gap: 18,
				}}>
				{MONTH_NAMES_BG.map((_, idx) => {
					const m = idx + 1;
					const tasks = tasksByMonth[m] ?? [];
					const ragTasks = ragTasksByMonth[m] ?? [];
					const visual = resolveSeasonVisual(crop, m);
					const isSelectedMonth = m === selectedMonth;
					return (
						<div
							key={`${crop}-${m}`}
							className="contact-panel season-cal-month-card"
							style={{
								margin: 0,
								padding: 16,
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'flex-start',
								minHeight: 'clamp(250px, 44vw, 320px)',
								borderColor: isSelectedMonth
									? 'rgba(124, 205, 156, 0.7)'
									: 'rgba(124, 205, 156, 0.22)',
								background: isSelectedMonth
									? 'linear-gradient(180deg, rgba(22, 45, 32, 0.88) 0%, rgba(14, 23, 18, 0.78) 100%)'
									: 'rgba(14, 23, 18, 0.72)',
							}}>
							<SeasonMonthArtBanner visual={visual} />
							<h3
								style={{
									marginTop: 0,
									marginBottom: tasks.length > 0 || ragTasks.length > 0 ? 10 : 0,
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									fontSize: '1rem',
								}}>
								<span
									style={{
										display: 'inline-flex',
										width: 28,
										height: 28,
										borderRadius: 8,
										alignItems: 'center',
										justifyContent: 'center',
										background: 'rgba(148, 163, 184, 0.15)',
										fontSize: '.85rem',
										fontWeight: 700,
									}}>
									{m}
								</span>
								{monthLabel(tr, idx)} {selectedYear}
							</h3>
							{tasks.length > 0 ? (
								<ul style={{ margin: 0, paddingLeft: 18, fontSize: '.85rem' }} className="muted">
									{tasks.map((t, i) => (
										<li key={i} style={{ marginBottom: 6 }}>
											{t}
										</li>
									))}
								</ul>
							) : null}
							{ragTasks.length > 0 ? (
								<>
									<p style={{ margin: '12px 0 8px', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.03em' }}>
										{lang === 'bg' ? 'AI оперативни задачи' : 'AI operational tasks'}
									</p>
									<ul style={{ margin: 0, paddingLeft: 18, fontSize: '.82rem', color: '#cdeed9' }}>
										{ragTasks.map((t, i) => (
											<li key={`${m}-rag-${i}`} style={{ marginBottom: 6 }}>
												{t}
											</li>
										))}
									</ul>
								</>
							) : null}
						</div>
					);
				})}
			</div>
		</section>
	);
}
