import { useState } from 'react';
import { Download, FileText, Package, Ship } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	TRADE_DOCS_EXPORT_BG,
	TRADE_DOCS_IMPORT_BG,
	TRADE_EXPORT_HANDBOOK_PDF,
	pickLocalized,
	type TradeDocSection,
} from '../lib/trade-documents-data';

type Tab = 'import' | 'export';

type Props = {
	lang: UiLang;
	tr: AppStrings;
};

function SectionList({ sections, lang }: { sections: TradeDocSection[]; lang: UiLang }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			{sections.map(sec => (
				<details
					key={sec.id}
					className="contact-panel"
					style={{
						borderColor: 'rgba(93, 189, 154, 0.28)',
						margin: 0,
					}}>
					<summary
						style={{
							cursor: 'pointer',
							fontWeight: 600,
							listStyle: 'none',
						}}>
						{pickLocalized(sec.title, lang)}
					</summary>
					<ul
						style={{
							margin: '12px 0 0',
							paddingInlineStart: 20,
							display: 'flex',
							flexDirection: 'column',
							gap: 10,
						}}>
						{sec.items.map((item, i) => (
							<li key={i} className="muted" style={{ lineHeight: 1.5 }}>
								{pickLocalized(item, lang)}
							</li>
						))}
					</ul>
				</details>
			))}
		</div>
	);
}

export function TradeDocumentsBulgariaView({ lang, tr }: Props) {
	const [tab, setTab] = useState<Tab>('import');
	const sections = tab === 'import' ? TRADE_DOCS_IMPORT_BG : TRADE_DOCS_EXPORT_BG;

	return (
		<section className="section">
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
					marginBottom: 16,
				}}>
				<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
					<FileText size={24} color="#5dbd9a" aria-hidden />
					{tr.tradeDocsTitle}
				</h2>
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.tradeDocsSubtitle}
			</p>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
				<button
					type="button"
					className={tab === 'import' ? 'btn btn-primary' : 'btn btn-outline'}
					onClick={() => setTab('import')}>
					<Ship size={16} aria-hidden /> {tr.tradeDocsTabImport}
				</button>
				<button
					type="button"
					className={tab === 'export' ? 'btn btn-primary' : 'btn btn-outline'}
					onClick={() => setTab('export')}>
					<Package size={16} aria-hidden /> {tr.tradeDocsTabExport}
				</button>
			</div>

			{tab === 'export' ? (
				<div
					className="contact-panel"
					style={{
						borderColor: 'rgba(93, 189, 154, 0.38)',
						background: 'rgba(93, 189, 154, 0.06)',
						marginBottom: 20,
					}}>
					<h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
						<Download size={20} color="#5dbd9a" aria-hidden />
						{tr.tradeDocsExportHandbookTitle}
					</h3>
					<p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.55, fontSize: '.9rem' }}>
						{tr.tradeDocsExportHandbookBody}
					</p>
					<a
						href={TRADE_EXPORT_HANDBOOK_PDF}
						download
						className="btn btn-primary"
						style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
						<Download size={16} aria-hidden />
						{tr.tradeDocsExportHandbookCta}
					</a>
				</div>
			) : null}

			<SectionList sections={sections} lang={lang} />

			<p
				className="muted"
				style={{
					marginTop: 24,
					fontSize: '.85rem',
					padding: '12px 14px',
					borderRadius: 8,
					background: 'rgba(93, 189, 154, 0.06)',
					border: '1px solid rgba(93, 189, 154, 0.22)',
					lineHeight: 1.55,
				}}>
				{tr.tradeDocsDisclaimer}
			</p>
		</section>
	);
}
