const FILE_EXT_RE = /\.(pdf|docx?|xlsx|zip)(\?|#|$)/i;

function safeDecodeSegment(seg: string): string {
	try {
		return decodeURIComponent(seg);
	} catch {
		return seg;
	}
}

export async function fetchHtmlPage(url: string, timeoutMs: number): Promise<string | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			redirect: 'follow',
			headers: {
				'User-Agent': 'SIMADocDiscovery/1.0 (public indexes; +https://agrinexus.eu)',
				Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
			},
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

/** Извлича абсолютни URL към типични „документни“ файлове от HTML индекс */
export function extractDocumentLinksFromHtml(html: string, baseUrl: string, maxLinks: number): { url: string; title: string }[] {
	const out: { url: string; title: string }[] = [];
	const seen = new Set<string>();
	const re = /href\s*=\s*["']([^"'>\s]+)["']/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		const href = m[1].trim();
		if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) continue;
		let absolute: string;
		try {
			absolute = new URL(href, baseUrl).href;
		} catch {
			continue;
		}
		if (!FILE_EXT_RE.test(absolute)) continue;
		const norm = absolute.split('#')[0];
		if (seen.has(norm)) continue;
		seen.add(norm);
		const path = new URL(norm).pathname;
		const last = path.split('/').filter(Boolean).pop() ?? norm;
		const title = safeDecodeSegment(last).replace(/\+/g, ' ');
		out.push({ url: norm, title });
		if (out.length >= maxLinks) break;
	}
	return out;
}

const SECONDARY_PATH_HINT =
	/(normativ|dokument|document|aktove|aktov|download|procedure|scheme|schemes|measures|mer|payment|subsid|isun|naredb|заповед|обявлен)/i;

/** Вътрешни HTML връзки от същия домейн, подредени по вероятност да водят към списъци с документи */
export function rankSecondaryHtmlPageUrls(html: string, baseUrl: string, maxPick: number): string[] {
	let origin: string;
	try {
		origin = new URL(baseUrl).origin;
	} catch {
		return [];
	}

	const candidates = new Map<string, number>();
	const re = /href\s*=\s*["']([^"'>\s]+)["']/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		const href = m[1].trim();
		if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) continue;
		let absolute: string;
		try {
			absolute = new URL(href, baseUrl).href.split('#')[0];
		} catch {
			continue;
		}
		if (!absolute.startsWith(origin)) continue;
		if (FILE_EXT_RE.test(absolute)) continue;
		const lower = absolute.toLowerCase();
		if (lower.endsWith('.css') || lower.endsWith('.js') || lower.endsWith('.jpg') || lower.endsWith('.png'))
			continue;

		let score = 0;
		if (SECONDARY_PATH_HINT.test(lower)) score += 6;
		if (/\/(bg|en)\//i.test(lower)) score += 1;
		if (lower.includes('ministerstvo') || lower.includes('government')) score += 2;

		candidates.set(absolute, Math.max(candidates.get(absolute) ?? 0, score));
	}

	return [...candidates.entries()]
		.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
		.slice(0, maxPick)
		.map(([u]) => u);
}
