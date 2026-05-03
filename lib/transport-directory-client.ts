import { SEED_TRANSPORT_COMPANIES } from './transport-directory-seed';
import type { TransportCompany, TransportCompanyDraft } from './transport-directory-types';
import {
	fetchTransportCompaniesFromCloud,
	insertTransportCompanyCloud,
} from './transport-directory-supabase';

const LOCAL_KEY = 'agrinexus-transport-registered-v1';

function mergeUnique(...lists: TransportCompany[][]): TransportCompany[] {
	const map = new Map<string, TransportCompany>();
	for (const list of lists) {
		for (const c of list) {
			map.set(c.id, c);
		}
	}
	return [...map.values()].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
}

export function loadLocalRegistered(): TransportCompany[] {
	try {
		const raw = localStorage.getItem(LOCAL_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(x): x is TransportCompany =>
				x != null &&
				typeof x === 'object' &&
				typeof (x as TransportCompany).id === 'string' &&
				typeof (x as TransportCompany).companyName === 'string'
		);
	} catch {
		return [];
	}
}

export function saveLocalRegistered(list: TransportCompany[]): void {
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
	} catch {
		/* quota */
	}
}

export function appendLocalCompany(c: TransportCompany): void {
	const cur = loadLocalRegistered();
	saveLocalRegistered([c, ...cur.filter(x => x.id !== c.id)]);
}

/** Seed + Supabase (ако е конфигуриран) + dev .local файл + локални записи */
export async function loadTransportCompanies(): Promise<TransportCompany[]> {
	const local = loadLocalRegistered();
	const cloud = await fetchTransportCompaniesFromCloud();

	let fromDevFile: TransportCompany[] = [];
	if (import.meta.env.DEV) {
		try {
			const r = await fetch('/api/transport-directory');
			if (r.ok) {
				const j = (await r.json()) as { companies?: TransportCompany[] };
				fromDevFile = j.companies ?? [];
			}
		} catch {
			/* offline */
		}
	}

	return mergeUnique(
		SEED_TRANSPORT_COMPANIES,
		cloud ?? [],
		fromDevFile,
		local
	);
}

export async function registerTransportCompany(
	draft: TransportCompanyDraft
): Promise<{ ok: true; company: TransportCompany } | { ok: false; error: string }> {
	const companyName = draft.companyName.trim();
	const email = draft.email.trim();
	const contactName = draft.contactName.trim();
	if (companyName.length < 2) return { ok: false, error: 'companyName' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email' };
	const company: TransportCompany = {
		id: globalThis.crypto?.randomUUID?.() ?? `tr-${Date.now()}`,
		companyName,
		contactName: contactName || companyName,
		email,
		phone: draft.phone.trim(),
		coverage: draft.coverage.trim(),
		fleetHint: draft.fleetHint.trim(),
		notes: draft.notes.trim(),
		createdAt: new Date().toISOString(),
	};
	appendLocalCompany(company);

	await insertTransportCompanyCloud(company);

	if (import.meta.env.DEV) {
		try {
			await fetch('/api/transport-directory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(company),
			});
		} catch {
			/* dev server down — local still saved */
		}
	}

	return { ok: true, company };
}
