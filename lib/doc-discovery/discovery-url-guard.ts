/** Безопасни HTTPS начални URL за обход — смекчен SSRF (локални/частни мрежи). */

function isBlockedHostname(host: string): boolean {
	const h = host.toLowerCase().trim();
	if (h === 'localhost') return true;
	if (/^127\.\d+\.\d+\.\d+$/.test(h)) return true;
	if (h.endsWith('.local')) return true;
	if (h === '[::1]' || h.startsWith('[fe80:')) return true;
	if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
	if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
	const m172 = /^172\.(\d+)\.\d+\.\d+$/.exec(h);
	if (m172) {
		const n = Number(m172[1]);
		if (n >= 16 && n <= 31) return true;
	}
	return false;
}

/** Нормализира само https начални страници за индекс. */
export function normalizeDiscoverySeedUrl(raw: string): string | null {
	const s = raw.trim();
	if (!s.startsWith('https://')) return null;
	try {
		const u = new URL(s);
		if (u.protocol !== 'https:') return null;
		if (isBlockedHostname(u.hostname)) return null;
		if (u.username || u.password) return null;
		u.hash = '';
		let path = u.pathname.replace(/\/+$/, '');
		if (path === '') path = '/';
		const out = `https://${u.hostname.toLowerCase()}${path}${u.search}`;
		if (out.length > 2048) return null;
		return out;
	} catch {
		return null;
	}
}

export function discoverySeedUrlId(normalizedUrl: string): string {
	let h = 5381;
	for (let i = 0; i < normalizedUrl.length; i++) {
		h = (h * 33) ^ normalizedUrl.charCodeAt(i);
	}
	return `dyn_${(h >>> 0).toString(36)}`;
}
