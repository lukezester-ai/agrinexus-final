import { loadFarmerProfile } from './farmer-profile-storage';
import {
	formatDeadlineHeadline,
	getActiveDeadlines,
	getMissingDocuments,
	getRiskFlags,
	line,
} from './command-center-data';
import type { UiLang } from './i18n';

function lg(lang: UiLang): 'bg' | 'en' | 'ar' {
	return lang;
}

/** Кратък текст за system prompt — документацията е водеща. */
export function buildFarmerContextForAi(lang: UiLang): string {
	const L = lg(lang);
	const p = loadFarmerProfile();
	const deadlines = getActiveDeadlines();
	const missing = getMissingDocuments(p);
	const risks = getRiskFlags(p);

	const rows: string[] = [];
	rows.push('=== FARMER PROFILE & COMPLIANCE SNAPSHOT (browser; may be empty) ===');
	rows.push(
		`Identity: name="${p.fullName || ''}" uin="${p.uin || ''}" farm="${p.farmName || ''}" region="${p.region || ''}" decares="${p.decares || ''}" iban="${p.iban ? 'provided' : 'missing'}"`,
	);
	rows.push(
		`Flags: land_rights_doc=${p.hasLandRightsDoc} bank_verified=${p.hasBankAccountVerified} organic_declared=${p.declaresOrganic} organic_cert=${p.hasOrganicCertificate}`,
	);
	rows.push('--- Deadlines (indicative; verify on dfz.bg / ISUN) ---');
	for (const d of deadlines) {
		rows.push(`${formatDeadlineHeadline(d, L)} | ${line(L, d.action)}`);
	}
	rows.push('--- Missing documents (heuristic) ---');
	if (missing.length === 0) rows.push('(none flagged from current profile)');
	else for (const m of missing) rows.push(line(L, m.label));
	rows.push('--- Risk flags (heuristic) ---');
	for (const r of risks) rows.push(`[${r.severity}] ${line(L, r.label)}`);
	return rows.join('\n');
}
