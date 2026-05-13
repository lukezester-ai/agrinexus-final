/** Локален профил на производител (браузър) — за чернови PDF (без чувствителни идентификатори). */

export type FarmerLocalProfile = {
	fullName: string;
	farmName: string;
	region: string;
	decares: string;
	/** Има документ за право на ползване на земята */
	hasLandRightsDoc: boolean;
	/** Потвърдена сметка за плащания от ДФЗ */
	hasBankAccountVerified: boolean;
	/** Декларира био/екосхема */
	declaresOrganic: boolean;
	/** Има валиден сертификат за био (при деклариране) */
	hasOrganicCertificate: boolean;
};

const STORAGE_KEY = 'agrinexus-farmer-profile-v1';

export const defaultFarmerProfile = (): FarmerLocalProfile => ({
	fullName: '',
	farmName: '',
	region: '',
	decares: '',
	hasLandRightsDoc: false,
	hasBankAccountVerified: false,
	declaresOrganic: false,
	hasOrganicCertificate: false,
});

export function loadFarmerProfile(): FarmerLocalProfile {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultFarmerProfile();
		const p = JSON.parse(raw) as Record<string, unknown>;
		const b = defaultFarmerProfile();
		return {
			...b,
			fullName: typeof p.fullName === 'string' ? p.fullName : b.fullName,
			farmName: typeof p.farmName === 'string' ? p.farmName : b.farmName,
			region: typeof p.region === 'string' ? p.region : b.region,
			decares: typeof p.decares === 'string' ? p.decares : b.decares,
			hasLandRightsDoc: Boolean(p.hasLandRightsDoc),
			hasBankAccountVerified: Boolean(p.hasBankAccountVerified),
			declaresOrganic: Boolean(p.declaresOrganic),
			hasOrganicCertificate: Boolean(p.hasOrganicCertificate),
		};
	} catch {
		return defaultFarmerProfile();
	}
}

export function saveFarmerProfile(p: FarmerLocalProfile): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
	} catch {
		/* ignore quota */
	}
}

/** Данни за PDF — същото като локалния профил (без отделни чувствителни полета). */
export function profileForPdf(): FarmerLocalProfile {
	if (typeof window === 'undefined') return defaultFarmerProfile();
	return loadFarmerProfile();
}
