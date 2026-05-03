import type { ReactNode } from 'react';
import { BookOpen, Download, FileText } from 'lucide-react';
import type { AppStrings } from '../lib/i18n';
import {
	DFZ_APPLICATIONS_PACK_PDF,
	DFZ_SUBSIDIES_IRREGULARITIES_DEADLINES_PDF,
	DFZ_YOUNG_FARMER_HANDBOOK_PDF,
} from '../lib/dfz-reference-pdfs';

type Props = {
	tr: AppStrings;
	/** По-компактни разстояния и текст за вграждане в командния център */
	compact?: boolean;
};

export function DfzOfficialPdfPack({ tr, compact }: Props) {
	const gap = compact ? 10 : 14;
	const pad = compact ? '12px 14px' : '14px 16px';

	return (
		<div
			className="contact-panel"
			style={{
				marginTop: compact ? 16 : 24,
				borderColor: 'rgba(124, 205, 156, 0.32)',
				background: 'rgba(124, 205, 156, 0.05)',
			}}>
			<h3 style={{ margin: '0 0 8px', fontSize: compact ? '1rem' : '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
				<FileText size={20} color="#7ccd9c" aria-hidden />
				{tr.dfzRefPackTitle}
			</h3>
			<p className="muted" style={{ margin: '0 0 14px', fontSize: compact ? '.82rem' : '.88rem', lineHeight: 1.55 }}>
				{tr.dfzRefPackIntro}
			</p>

			<div style={{ display: 'flex', flexDirection: 'column', gap }}>
				<DfzPdfRow
					icon={<BookOpen size={18} color="#7ccd9c" aria-hidden />}
					title={tr.dfzRefIrregularitiesTitle}
					body={tr.dfzRefIrregularitiesBody}
					href={DFZ_SUBSIDIES_IRREGULARITIES_DEADLINES_PDF}
					cta={tr.dfzRefDownloadCta}
					pad={pad}
				/>
				<DfzPdfRow
					icon={<BookOpen size={18} color="#7ccd9c" aria-hidden />}
					title={tr.dfzRefYoungFarmerTitle}
					body={tr.dfzRefYoungFarmerBody}
					href={DFZ_YOUNG_FARMER_HANDBOOK_PDF}
					cta={tr.dfzRefDownloadCta}
					pad={pad}
				/>
				<DfzPdfRow
					icon={<FileText size={18} color="#7ccd9c" aria-hidden />}
					title={tr.dfzRefApplicationsTitle}
					body={tr.dfzRefApplicationsBody}
					href={DFZ_APPLICATIONS_PACK_PDF}
					cta={tr.dfzRefDownloadCta}
					pad={pad}
				/>
			</div>
		</div>
	);
}

function DfzPdfRow({
	icon,
	title,
	body,
	href,
	cta,
	pad,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	href: string;
	cta: string;
	pad: string;
}) {
	return (
		<div
			style={{
				padding: pad,
				borderRadius: 12,
				border: '1px solid rgba(124, 205, 156, 0.22)',
				background: 'rgba(16, 28, 20, 0.35)',
			}}>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
				<div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<strong style={{ display: 'block', marginBottom: 6, fontSize: '.92rem' }}>{title}</strong>
					<p className="muted" style={{ margin: '0 0 10px', fontSize: '.84rem', lineHeight: 1.5 }}>
						{body}
					</p>
					<a href={href} download className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
						<Download size={16} aria-hidden />
						{cta}
					</a>
				</div>
			</div>
		</div>
	);
}
