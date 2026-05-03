import { getSupabaseBrowserClient } from './infra/supabase-browser';
import type { TransportCompany } from './transport-directory-types';

type DbRow = {
	id: string;
	company_name: string;
	contact_name: string;
	email: string;
	phone: string | null;
	coverage: string | null;
	fleet_hint: string | null;
	notes: string | null;
	created_at: string;
};

function rowToCompany(r: DbRow): TransportCompany {
	return {
		id: r.id,
		companyName: r.company_name,
		contactName: r.contact_name || r.company_name,
		email: r.email,
		phone: r.phone ?? '',
		coverage: r.coverage ?? '',
		fleetHint: r.fleet_hint ?? '',
		notes: r.notes ?? '',
		createdAt: r.created_at,
	};
}

export async function fetchTransportCompaniesFromCloud(): Promise<TransportCompany[] | null> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return null;
	const { data, error } = await sb
		.from('transport_companies')
		.select(
			'id, company_name, contact_name, email, phone, coverage, fleet_hint, notes, created_at'
		)
		.order('created_at', { ascending: false });
	if (error || !data) return null;
	return (data as DbRow[]).map(rowToCompany);
}

export async function insertTransportCompanyCloud(c: TransportCompany): Promise<boolean> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return false;
	const { error } = await sb.from('transport_companies').insert({
		id: c.id,
		company_name: c.companyName,
		contact_name: c.contactName,
		email: c.email,
		phone: c.phone,
		coverage: c.coverage,
		fleet_hint: c.fleetHint,
		notes: c.notes,
		created_at: c.createdAt,
	});
	return !error;
}
