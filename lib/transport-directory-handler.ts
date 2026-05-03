import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SEED_TRANSPORT_COMPANIES } from './transport-directory-seed';
import type { TransportCompany } from './transport-directory-types';

const FILE = join(process.cwd(), '.local', 'transport-registry.json');

async function readRegistryFile(): Promise<TransportCompany[]> {
	try {
		const raw = await readFile(FILE, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(x): x is TransportCompany =>
				x != null &&
				typeof x === 'object' &&
				typeof (x as TransportCompany).id === 'string'
		);
	} catch {
		return [];
	}
}

async function writeRegistryFile(list: TransportCompany[]): Promise<void> {
	await mkdir(join(process.cwd(), '.local'), { recursive: true });
	await writeFile(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export async function handleTransportDirectoryGet(): Promise<{
	ok: true;
	companies: TransportCompany[];
}> {
	const file = await readRegistryFile();
	return { ok: true, companies: mergeUnique(SEED_TRANSPORT_COMPANIES, file) };
}

function mergeUnique(a: TransportCompany[], b: TransportCompany[]): TransportCompany[] {
	const m = new Map<string, TransportCompany>();
	for (const c of a) m.set(c.id, c);
	for (const c of b) m.set(c.id, c);
	return [...m.values()].sort(
		(x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
	);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleTransportDirectoryPost(
	rawBody: unknown
): Promise<
	{ ok: true; company: TransportCompany } | { ok: false; status: number; error: string }
> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON' };
	}
	const b = rawBody as Record<string, unknown>;
	const companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
	const email = typeof b.email === 'string' ? b.email.trim() : '';
	const contactName = typeof b.contactName === 'string' ? b.contactName.trim() : '';
	const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
	const coverage = typeof b.coverage === 'string' ? b.coverage.trim() : '';
	const fleetHint = typeof b.fleetHint === 'string' ? b.fleetHint.trim() : '';
	const notes = typeof b.notes === 'string' ? b.notes.trim() : '';
	let id = typeof b.id === 'string' ? b.id.trim() : '';
	let createdAt = typeof b.createdAt === 'string' ? b.createdAt.trim() : '';

	if (companyName.length < 2) {
		return { ok: false, status: 400, error: 'Company name required' };
	}
	if (!EMAIL_RE.test(email)) {
		return { ok: false, status: 400, error: 'Valid email required' };
	}
	if (!id) id = `tr-${Date.now()}`;
	if (!createdAt) createdAt = new Date().toISOString();

	const company: TransportCompany = {
		id,
		companyName,
		contactName: contactName || companyName,
		email,
		phone,
		coverage,
		fleetHint,
		notes,
		createdAt,
	};

	const existing = await readRegistryFile();
	const next = [company, ...existing.filter(c => c.id !== company.id)];
	await writeRegistryFile(next);

	return { ok: true, company };
}
