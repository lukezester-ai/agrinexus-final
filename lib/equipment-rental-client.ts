import { SEED_EQUIPMENT_RENTAL_COMPANIES } from './equipment-rental-seed';
import type {
	EquipmentRentalCompany,
	EquipmentRentalCompanyDraft,
} from './equipment-rental-types';
import {
	fetchEquipmentRentalCompaniesFromCloud,
	insertEquipmentRentalCompanyCloud,
} from './equipment-rental-supabase';

const LOCAL_KEY = 'agrinexus-equipment-rental-registered-v1';

function mergeUnique(...lists: EquipmentRentalCompany[][]): EquipmentRentalCompany[] {
	const map = new Map<string, EquipmentRentalCompany>();
	for (const list of lists) {
		for (const c of list) {
			map.set(c.id, c);
		}
	}
	return [...map.values()].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
}

export function loadLocalEquipmentRentalRegistered(): EquipmentRentalCompany[] {
	try {
		const raw = localStorage.getItem(LOCAL_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(x): x is EquipmentRentalCompany =>
				x != null &&
				typeof x === 'object' &&
				typeof (x as EquipmentRentalCompany).id === 'string' &&
				typeof (x as EquipmentRentalCompany).companyName === 'string'
		);
	} catch {
		return [];
	}
}

export function saveLocalEquipmentRentalRegistered(list: EquipmentRentalCompany[]): void {
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
	} catch {
		/* quota */
	}
}

export function appendLocalEquipmentRentalCompany(c: EquipmentRentalCompany): void {
	const cur = loadLocalEquipmentRentalRegistered();
	saveLocalEquipmentRentalRegistered([c, ...cur.filter(x => x.id !== c.id)]);
}

export async function loadEquipmentRentalCompanies(): Promise<EquipmentRentalCompany[]> {
	const local = loadLocalEquipmentRentalRegistered();
	const cloud = await fetchEquipmentRentalCompaniesFromCloud();

	let fromDevFile: EquipmentRentalCompany[] = [];
	if (import.meta.env.DEV) {
		try {
			const r = await fetch('/api/equipment-rental');
			if (r.ok) {
				const j = (await r.json()) as { companies?: EquipmentRentalCompany[] };
				fromDevFile = j.companies ?? [];
			}
		} catch {
			/* offline */
		}
	}

	return mergeUnique(SEED_EQUIPMENT_RENTAL_COMPANIES, cloud ?? [], fromDevFile, local);
}

export async function registerEquipmentRentalCompany(
	draft: EquipmentRentalCompanyDraft
): Promise<{ ok: true; company: EquipmentRentalCompany } | { ok: false; error: string }> {
	const companyName = draft.companyName.trim();
	const email = draft.email.trim();
	const contactName = draft.contactName.trim();
	if (companyName.length < 2) return { ok: false, error: 'companyName' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email' };

	const company: EquipmentRentalCompany = {
		id: globalThis.crypto?.randomUUID?.() ?? `eq-${Date.now()}`,
		companyName,
		contactName: contactName || companyName,
		email,
		phone: draft.phone.trim(),
		coverage: draft.coverage.trim(),
		equipmentHint: draft.equipmentHint.trim(),
		services: draft.services.trim(),
		notes: draft.notes.trim(),
		createdAt: new Date().toISOString(),
	};
	appendLocalEquipmentRentalCompany(company);

	await insertEquipmentRentalCompanyCloud(company);

	if (import.meta.env.DEV) {
		try {
			await fetch('/api/equipment-rental', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(company),
			});
		} catch {
			/* dev server down - local still saved */
		}
	}
	return { ok: true, company };
}

