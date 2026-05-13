import { loadFarmerProfile } from './farmer-profile-storage';
import { formatDeadlineHeadline, getActiveDeadlines, line } from './command-center-data';
import type { UiLang } from './i18n';

function lg(lang: UiLang): 'bg' | 'en' {
	return lang;
}

/** Кратък текст за system prompt — документацията е водеща. */
export function buildFarmerContextForAi(lang: UiLang): string {
	const L = lg(lang);
	const p = loadFarmerProfile();
	const deadlines = getActiveDeadlines();

	const rows: string[] = [];
	rows.push('=== FARMER PROFILE SNAPSHOT (browser; may be empty; no national ID or bank details stored) ===');
	rows.push(
		`Identity: name="${p.fullName || ''}" farm="${p.farmName || ''}" region="${p.region || ''}" decares="${p.decares || ''}"`,
	);
	rows.push(
		`Flags: land_rights_doc=${p.hasLandRightsDoc} bank_verified=${p.hasBankAccountVerified} organic_declared=${p.declaresOrganic} organic_cert=${p.hasOrganicCertificate}`,
	);
	rows.push('--- Deadlines (indicative; verify on dfz.bg / ISUN) ---');
	for (const d of deadlines) {
		rows.push(`${formatDeadlineHeadline(d, L)} | ${line(L, d.action)}`);
	}
	return rows.join('\n');
}
