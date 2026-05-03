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
	const tasksByMonth = useMemo(() => SEASON_TASKS_BY_CROP[crop], [crop]);
	const showBgNote = lang !== 'bg' && tr.seasonCalendarBgNote.length > 0;

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
					<CalendarDays size={24} color="#5dbd9a" aria-hidden />
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
						background: 'rgba(93, 189, 154, 0.08)',
						border: '1px solid rgba(93, 189, 154, 0.28)',
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
							className={crop === k ? 'btn btn-primary' : 'btn btn-outline'}
							onClick={() => setCrop(k)}>
							{cropLabel(tr, k)}
						</button>
					))}
				</div>
			</div>

			<div
				className="contact-panel"
				style={{
					marginBottom: 24,
					borderColor: 'rgba(93, 189, 154, 0.28)',
					background: 'rgba(15, 23, 42, 0.45)',
				}}>
				<p style={{ margin: '0 0 10px', fontSize: '.75rem', fontWeight: 700, letterSpacing: '0.04em' }}>
					{tr.seasonCalendarDfzTitle}
				</p>
				<ul style={{ margin: 0, paddingLeft: 18, fontSize: '.88rem' }} className="muted">
					{DFZ_FIXED_DEADLINES.map((d, i) => (
						<li key={i} style={{ marginBottom: 6 }}>
							<strong>
								{d.day} {MONTH_NAMES_BG[d.month - 1]}
							</strong>
							{' — '}
							{d.title}
						</li>
					))}
				</ul>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
					gap: 14,
				}}>
				{MONTH_NAMES_BG.map((_, idx) => {
					const m = idx + 1;
					const tasks = tasksByMonth[m];
					if (!tasks?.length) return null;
					return (
						<div key={m} className="contact-panel" style={{ margin: 0 }}>
							<h3
								style={{
									marginTop: 0,
									marginBottom: 10,
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
									}}>
									{m}
								</span>
								{monthLabel(tr, idx)}
							</h3>
							<ul style={{ margin: 0, paddingLeft: 18, fontSize: '.85rem' }} className="muted">
								{tasks.map((t, i) => (
									<li key={i} style={{ marginBottom: 6 }}>
										{t}
									</li>
								))}
							</ul>
						</div>
					);
				})}
			</div>
		</section>
	);
}
