/** Honeypot field name — must stay empty (common bot trap). */
export const LEAD_FORM_HP_FIELD = 'hpCompanyWebsite' as const;
export const LEAD_FORM_OPENED_AT_FIELD = 'formOpenedAt' as const;

const MIN_FORM_MS = 2000;
const MAX_FORM_MS = 2 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 12;

const hitBuckets = new Map<string, number[]>();

function pruneHits(ip: string, now: number): number[] {
	const arr = hitBuckets.get(ip) ?? [];
	const pruned = arr.filter((t) => now - t < RATE_WINDOW_MS);
	if (pruned.length === 0) {
		hitBuckets.delete(ip);
	} else {
		hitBuckets.set(ip, pruned);
	}
	return pruned;
}

export function assertLeadFormAntiBot(
	raw: Record<string, unknown>,
	opts: { clientIp: string | null }
): { ok: false; status: number; error: string; hint?: string } | { ok: true } {
	const ip = (opts.clientIp && opts.clientIp.trim()) || 'unknown';
	const now = Date.now();
	const bucket = pruneHits(ip, now);
	if (bucket.length >= RATE_MAX_PER_WINDOW) {
		return { ok: false, status: 429, error: 'Too many requests', hint: 'Please try again later.' };
	}

	const hpRaw = raw[LEAD_FORM_HP_FIELD];
	if (hpRaw != null && typeof hpRaw !== 'string') {
		return { ok: false, status: 400, error: 'Request could not be processed' };
	}
	if (typeof hpRaw === 'string' && hpRaw.trim().length > 0) {
		return { ok: false, status: 400, error: 'Request could not be processed' };
	}

	const opened = raw[LEAD_FORM_OPENED_AT_FIELD];
	const t =
		typeof opened === 'number' && Number.isFinite(opened)
			? opened
			: typeof opened === 'string' && /^\d{10,15}$/.test(opened.trim())
				? Number(opened.trim())
				: NaN;
	/** Rough ms range (2020–5138) — rejects junk and seconds-by-mistake. */
	if (!Number.isFinite(t) || t < 1_600_000_000_000 || t > 10_000_000_000_000) {
		return { ok: false, status: 400, error: 'Request could not be processed' };
	}
	if (t > now + 120_000) {
		return { ok: false, status: 400, error: 'Request could not be processed' };
	}
	const elapsed = now - t;
	if (elapsed < MIN_FORM_MS) {
		return {
			ok: false,
			status: 429,
			error: 'Too fast',
			hint: 'Please wait a moment and try again.',
		};
	}
	if (elapsed > MAX_FORM_MS) {
		return {
			ok: false,
			status: 400,
			error: 'Session expired',
			hint: 'Please refresh the page and try again.',
		};
	}

	bucket.push(now);
	hitBuckets.set(ip, bucket);
	return { ok: true };
}
