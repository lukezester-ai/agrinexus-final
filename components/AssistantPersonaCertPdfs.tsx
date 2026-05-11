import type { ChatPersona } from '../lib/chat-persona';
import { certBioDocsForPersona } from '../lib/cert-bio-persona-docs';
import type { AppStrings } from '../lib/i18n';
import type { UiLang } from '../lib/i18n';
import { FileText } from 'lucide-react';

type Props = {
	persona: ChatPersona;
	lang: UiLang;
	tr: AppStrings;
};

export function AssistantPersonaCertPdfs({ persona, lang, tr }: Props) {
	const docs = certBioDocsForPersona(persona);
	if (!docs?.length) {
		return (
			<p className="muted" style={{ margin: '0 0 10px', fontSize: '.78rem', lineHeight: 1.45 }}>
				{tr.assistantCertPdfPickPersona}
			</p>
		);
	}
	return (
		<div style={{ marginBottom: 10 }}>
			<p className="muted" style={{ margin: '0 0 6px', fontSize: '.78rem', fontWeight: 600 }}>
				<FileText size={14} aria-hidden style={{ marginRight: 6, verticalAlign: 'text-bottom', opacity: 0.85 }} />
				{tr.assistantCertPdfSectionTitle}
			</p>
			<div className="deal-actions assistant-quick-prompts-scroll" role="list">
				{docs.map(d => (
					<a
						key={d.href}
						role="listitem"
						href={d.href}
						target="_blank"
						rel="noopener noreferrer"
						className="deal-chip-btn"
						style={{ textDecoration: 'none', fontSize: '.76rem', lineHeight: 1.25 }}>
						{lang === 'bg' ? d.bg : d.en}
					</a>
				))}
			</div>
		</div>
	);
}
