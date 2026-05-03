import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FileWarning, FileDown, Loader2 } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import type { UiLang } from '../lib/i18n';
import {
	formatDeadlineHeadline,
	getActiveDeadlines,
	getMissingDocuments,
	getRiskFlags,
	line,
	type CommandDeadline,
} from '../lib/command-center-data';
import {
	defaultFarmerProfile,
	loadFarmerProfile,
	saveFarmerProfile,
	type FarmerLocalProfile,
} from '../lib/farmer-profile-storage';
import {
	buildApplicationSummaryPdf,
	buildDeclarationPdf,
	buildDocumentPackPdf,
	buildLeaseContractDraftPdf,
	buildStatementPdf,
	downloadPdfBytes,
} from '../lib/pdf/generate-documents';

type Props = {
	lang: UiLang;
	tr: AppStrings;
	/** Кратък блок за начална страница */
	compact?: boolean;
	onExpand?: () => void;
};

function lang3(l: UiLang): 'bg' | 'en' | 'ar' {
	return l;
}

export function FarmerCommandCenter({ lang, tr, compact, onExpand }: Props) {
	const L = lang3(lang);
	const [profile, setProfile] = useState<FarmerLocalProfile>(() =>
		typeof localStorage !== 'undefined' ? loadFarmerProfile() : defaultFarmerProfile(),
	);
	const [pdfBusy, setPdfBusy] = useState<string | null>(null);
	const [pdfErr, setPdfErr] = useState<string | null>(null);

	useEffect(() => {
		setProfile(loadFarmerProfile());
	}, []);

	useEffect(() => {
		const t = window.setTimeout(() => saveFarmerProfile(profile), 350);
		return () => window.clearTimeout(t);
	}, [profile]);

	const deadlines = useMemo(() => getActiveDeadlines(), []);
	const missing = useMemo(() => getMissingDocuments(profile), [profile]);
	const risks = useMemo(() => getRiskFlags(profile), [profile]);

	const showDeadlines = compact ? deadlines.slice(0, 1) : deadlines;
	const showMissing = compact ? missing.slice(0, 1) : missing;
	const showRisks = compact ? risks.slice(0, 1) : risks;

	const runPdf = useCallback(
		async (kind: 'declaration' | 'application' | 'lease' | 'statement' | 'pack') => {
			setPdfErr(null);
			const key = kind;
			setPdfBusy(key);
			try {
				let bytes: Uint8Array;
				let name: string;
				if (kind === 'declaration') {
					bytes = await buildDeclarationPdf(profile);
					name = 'agrinexus-deklaratsiya-chernova.pdf';
				} else if (kind === 'application') {
					bytes = await buildApplicationSummaryPdf(profile);
					name = 'agrinexus-zayavlenie-obobshtenie.pdf';
				} else if (kind === 'lease') {
					bytes = await buildLeaseContractDraftPdf(profile);
					name = 'agrinexus-dogovor-arenda-chernova.pdf';
				} else if (kind === 'statement') {
					bytes = await buildStatementPdf(profile);
					name = 'agrinexus-spravka.pdf';
				} else {
					bytes = await buildDocumentPackPdf(profile);
					name = 'agrinexus-paket-dokumenti.pdf';
				}
				downloadPdfBytes(bytes, name);
			} catch {
				setPdfErr(tr.commandGenerateError);
			} finally {
				setPdfBusy(null);
			}
		},
		[profile, tr.commandGenerateError],
	);

	const update = (patch: Partial<FarmerLocalProfile>) => {
		setProfile(p => ({ ...p, ...patch }));
	};

	return (
		<div
			className="contact-panel"
			style={{
				marginTop: compact ? 12 : 0,
				marginBottom: compact ? 20 : 0,
				borderColor: 'rgba(93, 189, 154, 0.28)',
				background: 'rgba(15, 23, 42, 0.55)',
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

				<section>
					<h3
						style={{
							margin: '0 0 10px',
							fontSize: '.8rem',
							letterSpacing: '0.06em',
							textTransform: 'uppercase',
							color: '#7dd3fc',
							display: 'flex',
							alignItems: 'center',
							gap: 8,
						}}>
						<FileWarning size={16} aria-hidden />
						{tr.commandSectionDocs}
					</h3>
					{showMissing.length === 0 ? (
						<p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>
							{tr.commandNoMissingDocs}
						</p>
					) : (
						<ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
							{showMissing.map(m => (
								<li key={m.id} style={{ marginBottom: 10, fontSize: '.9rem' }}>
									<strong>{line(L, m.label)}</strong>
									<div className="muted" style={{ marginTop: 4, fontSize: '.82rem' }}>
										{line(L, m.hint)}
									</div>
								</li>
							))}
						</ul>
					)}
				</section>

				<section>
					<h3
						style={{
							margin: '0 0 10px',
							fontSize: '.8rem',
							letterSpacing: '0.06em',
							textTransform: 'uppercase',
							color: '#94a3b8',
							display: 'flex',
							alignItems: 'center',
							gap: 8,
						}}>
						<AlertTriangle size={16} aria-hidden />
						{tr.commandSectionRisks}
					</h3>
					<ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
						{showRisks.map(r => (
							<li key={r.id} style={{ marginBottom: 10, fontSize: '.9rem' }}>
								<span
									style={{
										fontSize: '.72rem',
										fontWeight: 700,
										marginRight: 8,
										color: r.severity === 'high' ? '#f87171' : '#94a3b8',
									}}>
									{r.severity === 'high' ? tr.commandSeverityHigh : tr.commandSeverityMed}
								</span>
								{line(L, r.label)}
							</li>
						))}
					</ul>
				</section>

				{!compact && (
					<>
						<section>
							<h3
								style={{
									margin: '0 0 12px',
									fontSize: '.8rem',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									color: '#5eead4',
								}}>
								{tr.commandSectionProfile}
							</h3>
							<div
								className="form-grid"
								style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
									gap: 10,
								}}>
								<input
									placeholder={tr.commandFullName}
									value={profile.fullName}
									onChange={e => update({ fullName: e.target.value })}
								/>
								<input
									placeholder={tr.commandUin}
									value={profile.uin}
									onChange={e => update({ uin: e.target.value })}
								/>
								<input
									placeholder={tr.commandFarmName}
									value={profile.farmName}
									onChange={e => update({ farmName: e.target.value })}
								/>
								<input
									placeholder={tr.commandRegion}
									value={profile.region}
									onChange={e => update({ region: e.target.value })}
								/>
								<input
									placeholder={tr.commandDecares}
									value={profile.decares}
									onChange={e => update({ decares: e.target.value })}
								/>
								<input
									placeholder={tr.commandIban}
									value={profile.iban}
									onChange={e => update({ iban: e.target.value })}
								/>
							</div>
							<div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
								<label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
									<input
										type="checkbox"
										checked={profile.hasLandRightsDoc}
										onChange={e => update({ hasLandRightsDoc: e.target.checked })}
									/>
									<span style={{ fontSize: '.88rem' }}>{tr.commandLandCheck}</span>
								</label>
								<label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
									<input
										type="checkbox"
										checked={profile.hasBankAccountVerified}
										onChange={e => update({ hasBankAccountVerified: e.target.checked })}
									/>
									<span style={{ fontSize: '.88rem' }}>{tr.commandBankCheck}</span>
								</label>
								<label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
									<input
										type="checkbox"
										checked={profile.declaresOrganic}
										onChange={e => update({ declaresOrganic: e.target.checked })}
									/>
									<span style={{ fontSize: '.88rem' }}>{tr.commandOrganicDeclared}</span>
								</label>
								<label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
									<input
										type="checkbox"
										checked={profile.hasOrganicCertificate}
										onChange={e => update({ hasOrganicCertificate: e.target.checked })}
									/>
									<span style={{ fontSize: '.88rem' }}>{tr.commandOrganicCert}</span>
								</label>
							</div>
						</section>

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
