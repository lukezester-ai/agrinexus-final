import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertLeadFormAntiBot } from './form-bot-guard.js';
import type { LeadHandlerCtx } from './leads-handler.js';
import { getSupabaseServiceClient } from './infra/supabase-service.js';
import { resolveUserFromAccessToken } from './supabase-resolve-access-token.js';
import {
	buildFieldlotListingEmailHtml,
	buildFieldlotListingEmailText,
	fieldlotListingNotificationSubject,
	sendInboundNotification,
} from './email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export type FieldlotListingPublic = {
	id: string;
	created_at: string;
	role: string;
	title: string;
	body: string;
	full_name: string;
	company_name: string;
	business_email: string;
	phone: string;
};

/** Ред в .local JSONL — може да съдържа user_id за одит; GET не го връща към клиента. */
type FieldlotListingStoredRow = FieldlotListingPublic & { user_id?: string | null };

export type FieldlotListingsPostCtx = LeadHandlerCtx & {
	/** Access token от `Authorization: Bearer …` (без префикса Bearer). */
	authorizationAccessToken?: string | null;
};

function normalizePhone(value: string): string {
	const digitsOnly = value.replace(/\D/g, '');
	if (!digitsOnly) return '';
	return `+${digitsOnly}`.slice(0, 16);
}

function isVercel(): boolean {
	return process.env.VERCEL === '1' || process.env.VERCEL === 'true';
}

/** Локален append-only JSONL само извън Vercel (dev / self-host с диск). */
function shouldPersistFieldlotListingsLocally(): boolean {
	if (getSupabaseServiceClient()) return false;
	if (isVercel()) return false;
	if (process.env.FIELDLOT_LOCAL_LISTINGS === '0') return false;
	return true;
}

function localListingsPath(): string {
	return join(process.cwd(), '.local', 'fieldlot-listings.jsonl');
}

async function appendLocalListing(row: FieldlotListingStoredRow): Promise<void> {
	const dir = join(process.cwd(), '.local');
	await mkdir(dir, { recursive: true });
	await appendFile(localListingsPath(), JSON.stringify(row) + '\n', 'utf8');
}

async function readLocalListings(limit: number): Promise<FieldlotListingPublic[]> {
	try {
		const raw = await readFile(localListingsPath(), 'utf8');
		const rows: FieldlotListingPublic[] = [];
		for (const line of raw.split('\n')) {
			const t = line.trim();
			if (!t) continue;
			try {
				const parsed = JSON.parse(t) as FieldlotListingStoredRow;
				const { user_id: _uid, ...pub } = parsed;
				rows.push(pub);
			} catch {
				/* skip bad line */
			}
		}
		rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
		return rows.slice(0, limit);
	} catch {
		return [];
	}
}

export async function handleFieldlotListingsGet(): Promise<
	{ ok: true; listings: FieldlotListingPublic[]; storage: 'supabase' | 'local' | 'none' } | { ok: false; status: number; error: string }
> {
	const limit = 200;
	const supabase = getSupabaseServiceClient();
	if (supabase) {
		const { data, error } = await supabase
			.from('fieldlot_listings')
			.select(
				'id, created_at, role, title, body, full_name, company_name, business_email, phone'
			)
			.order('created_at', { ascending: false })
			.limit(limit);
		if (error) {
			const msg = (error.message || '').toLowerCase();
			const missing =
				msg.includes('fieldlot_listings') &&
				(msg.includes('does not exist') ||
					msg.includes('schema cache') ||
					msg.includes('could not find the table'));
			if (missing) {
				return { ok: true, listings: [], storage: 'supabase' };
			}
			return {
				ok: false,
				status: 500,
				error: error.message,
			};
		}
		return { ok: true, listings: (data ?? []) as FieldlotListingPublic[], storage: 'supabase' };
	}
	if (shouldPersistFieldlotListingsLocally()) {
		const listings = await readLocalListings(limit);
		return { ok: true, listings, storage: 'local' };
	}
	return { ok: true, listings: [], storage: 'none' };
}

export async function handleFieldlotListingsPost(
	rawBody: unknown,
	ctx?: FieldlotListingsPostCtx
): Promise<
	| { ok: true; listing: Pick<FieldlotListingPublic, 'id' | 'created_at'>; mailDelivery: 'sent' | 'skipped' }
	| { ok: false; status: number; error: string; hint?: string }
> {
	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const b = rawBody as Record<string, unknown>;
	const anti = assertLeadFormAntiBot(b, { clientIp: ctx?.clientIp ?? null });
	if (!anti.ok) {
		return { ok: false, status: anti.status, error: anti.error, hint: anti.hint };
	}

	const rawFullName = typeof b.fullName === 'string' ? b.fullName.trim() : '';
	const companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
	const businessEmail = typeof b.businessEmail === 'string' ? b.businessEmail.trim() : '';
	const phone = typeof b.phone === 'string' ? normalizePhone(b.phone) : '';
	const role = typeof b.role === 'string' ? b.role.trim() : '';
	const title = typeof b.listingTitle === 'string' ? b.listingTitle.trim() : '';
	const body = typeof b.listingBody === 'string' ? b.listingBody.trim() : '';
	const subscribeAlerts = Boolean(b.subscribeAlerts);

	if (!rawFullName || rawFullName.length < 2) {
		return { ok: false, status: 400, error: 'Valid full name required' };
	}
	if (!businessEmail || !EMAIL_RE.test(businessEmail)) {
		return { ok: false, status: 400, error: 'Valid business email required' };
	}
	if (phone && !PHONE_RE.test(phone)) {
		return {
			ok: false,
			status: 400,
			error: 'Valid phone required',
			hint: 'Provide phone in E.164 format, e.g. +359881234567.',
		};
	}
	if (!role || role.length > 80) {
		return { ok: false, status: 400, error: 'Valid role required' };
	}
	if (title.length < 3 || title.length > 200) {
		return { ok: false, status: 400, error: 'Listing title must be 3–200 characters' };
	}
	if (body.length < 10 || body.length > 8000) {
		return { ok: false, status: 400, error: 'Listing description must be 10–8000 characters' };
	}

	const auth = await resolveUserFromAccessToken(ctx?.authorizationAccessToken ?? null);
	if (!auth.ok) {
		return { ok: false, status: auth.status, error: auth.error, hint: auth.hint };
	}
	const viewer = auth.user;
	if (viewer.email && businessEmail.toLowerCase() !== viewer.email.toLowerCase()) {
		return {
			ok: false,
			status: 403,
			error: 'Имейлът в формата трябва да съвпада с акаунта, с който си влязъл.',
			hint: 'Промени полето „Имейл“ или влез с друг акаунт (същият Supabase акаунт като в AgriNexus).',
		};
	}

	const row: Omit<FieldlotListingPublic, 'id' | 'created_at'> = {
		role,
		title,
		body,
		full_name: rawFullName,
		company_name: companyName,
		business_email: businessEmail,
		phone,
	};

	const supabase = getSupabaseServiceClient();
	let id: string;
	let created_at: string;

	if (supabase) {
		const { data, error } = await supabase
			.from('fieldlot_listings')
			.insert({
				role: row.role,
				title: row.title,
				body: row.body,
				full_name: row.full_name,
				company_name: row.company_name,
				business_email: row.business_email,
				phone: row.phone,
				subscribe_alerts: subscribeAlerts,
				user_id: viewer.userId,
			})
			.select('id, created_at')
			.single();
		if (error) {
			const msg = (error.message || '').toLowerCase();
			const missingUserIdCol =
				msg.includes('user_id') && (msg.includes('column') || msg.includes('schema cache'));
			return {
				ok: false,
				status: 500,
				error: error.message,
				hint: missingUserIdCol
					? 'Добави колона user_id: изпълни отново supabase-fieldlot-listings.sql (ALTER TABLE … user_id).'
					: 'Run supabase-fieldlot-listings.sql in Supabase if the table is missing.',
			};
		}
		if (!data?.id || !data.created_at) {
			return { ok: false, status: 500, error: 'Insert returned no row' };
		}
		id = data.id as string;
		created_at = data.created_at as string;
	} else if (shouldPersistFieldlotListingsLocally()) {
		id = randomUUID();
		created_at = new Date().toISOString();
		await appendLocalListing({
			id,
			created_at,
			...row,
			user_id: viewer.userId,
		});
	} else {
		return {
			ok: false,
			status: 503,
			error: 'Listing storage is not configured',
			hint: isVercel()
				? 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase-fieldlot-listings.sql.'
				: 'Set Supabase env vars, or use local dev storage (automatic when not on Vercel and FIELDLOT_LOCAL_LISTINGS is not 0).',
		};
	}

	const mail = await sendInboundNotification({
		subject: fieldlotListingNotificationSubject(title),
		html: buildFieldlotListingEmailHtml({
			id,
			created_at,
			...row,
			subscribe_alerts: subscribeAlerts,
			user_id: viewer.userId,
		}),
		text: buildFieldlotListingEmailText({
			id,
			created_at,
			...row,
			subscribe_alerts: subscribeAlerts,
			user_id: viewer.userId,
		}),
		replyTo: businessEmail,
	});

	if (mail.status === 'failed') {
		return {
			ok: false,
			status: 502,
			error: 'Email delivery failed',
			hint: mail.error,
		};
	}

	return {
		ok: true,
		listing: { id, created_at },
		mailDelivery: mail.status === 'sent' ? 'sent' : 'skipped',
	};
}
