import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import type { UiLang } from '../lib/i18n';
import {
	formatDeadlineHeadline,
	getActiveDeadlines,
	line,
	type CommandDeadline,
} from '../lib/command-center-data';
import { DfzOfficialPdfPack } from './DfzOfficialPdfPack';

type Props = {
	lang: UiLang;
	tr: AppStrings;
	/** Кратък блок за начална страница */
	compact?: boolean;
	onExpand?: () => void;
};

function lang2(l: UiLang): 'bg' | 'en' {
	return l;
}

export function FarmerCommandCenter({ lang, tr, compact, onExpand }: Props) {
	const L = lang2(lang);

	const deadlines = useMemo(() => getActiveDeadlines(), []);
	const showDeadlines = compact ? deadlines.slice(0, 1) : deadlines;

	return (
		<div
			className="contact-panel"
			style={{
				marginTop: compact ? 12 : 0,
				marginBottom: compact ? 20 : 0,
				borderColor: 'rgba(124, 205, 156, 0.28)',
				background: 'rgba(16, 28, 20, 0.58)',
			}}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
				<div>
					<h2 style={{ margin: '0 0 6px', fontSize: compact ? '1.05rem' : '1.25rem' }}>
						{compact ? tr.commandCompactTitle : tr.commandPageTitle}
					</h2>
					<p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>
						{compact ? tr.commandCompactSub : tr.commandPageSub}
					</p>
					<p className="muted" style={{ margin: '8px 0 0', fontSize: '.78rem' }}>
						{tr.commandGovDataNote}
					</p>
				</div>
				{compact && onExpand ? (
					<button type="button" className="btn btn-primary" onClick={onExpand}>
						{tr.commandCompactCta}
					</button>
				) : null}
			</div>

			<div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
				<section>
					<h3
						style={{
							margin: '0 0 10px',
							fontSize: '.8rem',
							letterSpacing: '0.06em',
							textTransform: 'uppercase',
							color: '#5eead4',
							display: 'flex',
							alignItems: 'center',
							gap: 8,
						}}>
						<CalendarClock size={16} aria-hidden />
						{tr.commandSectionDeadlines}
					</h3>
					<ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
						{showDeadlines.map((d: CommandDeadline) => (
							<li key={d.id} style={{ marginBottom: 10, fontSize: '.9rem' }}>
								<strong>{formatDeadlineHeadline(d, L)}</strong>
								<div className="muted" style={{ marginTop: 4, fontSize: '.84rem' }}>
									{line(L, d.action)}
								</div>
								<div className="muted" style={{ marginTop: 4, fontSize: '.76rem' }}>
									{line(L, d.sourceNote)}
								</div>
							</li>
						))}
					</ul>
				</section>

				{!compact && <DfzOfficialPdfPack tr={tr} compact />}
			</div>
		</div>
	);
}
