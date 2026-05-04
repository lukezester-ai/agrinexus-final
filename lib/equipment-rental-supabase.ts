import { getSupabaseBrowserClient } from './infra/supabase-browser';
import type { EquipmentRentalCompany } from './equipment-rental-types';

type DbRow = {
	id: string;
	company_name: string;
	contact_name: string;
	email: string;
	phone: string | null;
	coverage: string | null;
	equipment_hint: string | null;
	services: string | null;
	notes: string | null;
	created_at: string;
};

function rowToCompany(r: DbRow): EquipmentRentalCompany {
	return {
		id: r.id,
		companyName: r.company_name,
		contactName: r.contact_name || r.company_name,
		email: r.email,
		phone: r.phone ?? '',
		coverage: r.coverage ?? '',
		equipmentHint: r.equipment_hint ?? '',
		services: r.services ?? '',
		notes: r.notes ?? '',
		createdAt: r.created_at,
	};
}

export async function fetchEquipmentRentalCompaniesFromCloud(): Promise<EquipmentRentalCompany[] | null> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return null;
	const { data, error } = await sb
		.from('equipment_rental_companies')
		.select(
			'id, company_name, contact_name, email, phone, coverage, equipment_hint, services, notes, created_at'
		)
		.order('created_at', { ascending: false });
	if (error || !data) return null;
	return (data as DbRow[]).map(rowToCompany);
}

export async function insertEquipmentRentalCompanyCloud(c: EquipmentRentalCompany): Promise<boolean> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return false;
	const { error } = await sb.from('equipment_rental_companies').insert({
		id: c.id,
		company_name: c.companyName,
		contact_name: c.contactName,
		email: c.email,
		phone: c.phone,
		coverage: c.coverage,
		equipment_hint: c.equipmentHint,
		services: c.services,
		notes: c.notes,
		created_at: c.createdAt,
	});
	return !error;
}

