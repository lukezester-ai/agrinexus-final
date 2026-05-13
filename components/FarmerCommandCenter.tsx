import { useCallback, useMemo, useState } from 'react';
import { CalendarClock, FileDown, Loader2 } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import type { UiLang } from '../lib/i18n';
import {
	formatDeadlineHeadline,
	getActiveDeadlines,
	line,
	type CommandDeadline,
} from '../lib/command-center-data';
import { profileForPdf } from '../lib/farmer-profile-storage';
import {
	buildApplicationSummaryPdf,
	buildDeclarationPdf,
	buildDocumentPackPdf,
	buildLeaseContractDraftPdf,
	buildStatementPdf,
	downloadPdfBytes,
} from '../lib/pdf/generate-documents';
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
	const [pdfBusy, setPdfBusy] = useState<string | null>(null);
	const [pdfErr, setPdfErr] = useState<string | null>(null);

	const deadlines = useMemo(() => getActiveDeadlines(), []);
	const showDeadlines = compact ? deadlines.slice(0, 1) : deadlines;

	const runPdf = useCallback(
		async (kind: 'declaration' | 'application' | 'lease' | 'statement' | 'pack') => {
			setPdfErr(null);
			const key = kind;
			setPdfBusy(key);
			const profile = profileForPdf();
			const buildOnce = async (): Promise<{ bytes: Uint8Array; name: string }> => {
				if (kind === 'declaration') {
					return { bytes: await buildDeclarationPdf(profile), name: 'sima-deklaratsiya-chernova.pdf' };
				}
				if (kind === 'application') {
					return {
						bytes: await buildApplicationSummaryPdf(profile),
						name: 'sima-zayavlenie-obobshtenie.pdf',
					};
				}
				if (kind === 'lease') {
					return {
						bytes: await buildLeaseContractDraftPdf(profile),
						name: 'sima-dogovor-arenda-chernova.pdf',
					};
				}
				if (kind === 'statement') {
					return { bytes: await buildStatementPdf(profile), name: 'sima-spravka.pdf' };
				}
				return { bytes: await buildDocumentPackPdf(profile), name: 'sima-paket-dokumenti.pdf' };
			};
			try {
				let lastErr: unknown;
				for (let attempt = 0; attempt < 2; attempt += 1) {
					try {
						const { bytes, name } = await buildOnce();
						downloadPdfBytes(bytes, name);
						return;
					} catch (e) {
						lastErr = e;
						if (attempt === 0) await new Promise<void>(r => window.setTimeout(r, 600));
					}
				}
				throw lastErr;
			} catch {
				setPdfErr(tr.commandGenerateError);
			} finally {
				setPdfBusy(null);
			}
		},
		[tr.commandGenerateError],
	);

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

				{!compact && (
					<>
						<DfzOfficialPdfPack tr={tr} compact />

						<section>
							<h3
								style={{
									margin: '0 0 12px',
									fontSize: '.8rem',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									color: '#7dd3fc',
								}}>
								{tr.commandSectionPdf}
							</h3>
							<p className="muted" style={{ fontSize: '.82rem', marginTop: 0 }}>
								{tr.commandPdfFootnote}
							</p>
							<p className="muted" style={{ fontSize: '.78rem', marginTop: 8 }}>
								{tr.commandPdfDataHint}
							</p>
							{pdfErr ? (
								<p style={{ color: '#f87171', fontSize: '.86rem', margin: '8px 0' }}>{pdfErr}</p>
							) : null}
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
								<PdfBtn
									label={tr.commandDownloadPack}
									busy={pdfBusy === 'pack'}
									onClick={() => void runPdf('pack')}
								/>
								<PdfBtn
									label={tr.commandDownloadDeclaration}
									busy={pdfBusy === 'declaration'}
									onClick={() => void runPdf('declaration')}
								/>
								<PdfBtn
									label={tr.commandDownloadApplication}
									busy={pdfBusy === 'application'}
									onClick={() => void runPdf('application')}
								/>
								<PdfBtn
									label={tr.commandDownloadContract}
									busy={pdfBusy === 'lease'}
									onClick={() => void runPdf('lease')}
								/>
								<PdfBtn
									label={tr.commandDownloadStatement}
									busy={pdfBusy === 'statement'}
									onClick={() => void runPdf('statement')}
								/>
							</div>
						</section>
					</>
				)}
			</div>
		</div>
	);
}

function PdfBtn({
	label,
	busy,
	onClick,
}: {
	label: string;
	busy: boolean;
	onClick: () => void;
}) {
	return (
		<button type="button" className="btn btn-outline" disabled={busy} onClick={onClick}>
			{busy ? <Loader2 className="spin" size={16} aria-hidden /> : <FileDown size={16} aria-hidden />}
			{label}
		</button>
	);
}
