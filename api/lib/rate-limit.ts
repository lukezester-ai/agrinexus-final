type Bucket = { n: number; t: number };
const buckets = new Map<string, Bucket>();

/** Прост sliding прозорец (in-memory; подходящ за serverless с ограничен трафик). */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
	const now = Date.now();
	let b = buckets.get(key);
	if (!b || now - b.t > windowMs) {
		b = { n: 0, t: now };
	}
	b.n += 1;
	buckets.set(key, b);
	return b.n <= max;
}

export function clientIpFromVercelRequest(req: { headers?: { [k: string]: string | string[] | undefined }; socket?: { remoteAddress?: string } }): string {
	const xf = req.headers?.['x-forwarded-for'];
	const first = Array.isArray(xf) ? xf[0] : xf?.split(',')[0]?.trim();
	if (first) return first;
	return req.socket?.remoteAddress || 'unknown';
}
