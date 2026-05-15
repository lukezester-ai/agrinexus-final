/**
 * Универсален fetch-er за документи (PDF/HTML/plaintext).
 *
 * Поддържа:
 *   - Локални URL-и започващи с `/docs/...` → чете от `public/docs/...`
 *   - HTTP/HTTPS URL-и → fetch с таймаут, max-size guard и redirect follow
 *
 * Връща суровите байтове + засечения content-type, без да решава как да парсва.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type FetchedDoc = {
	url: string;
	bytes: Uint8Array;
	contentType: string;
	finalUrl: string;
	source: 'local' | 'remote';
};

export type FetchOptions = {
	timeoutMs?: number;
	maxBytes?: number;
	publicDir?: string;
};

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
	pdf: 'application/pdf',
	html: 'text/html',
	htm: 'text/html',
	txt: 'text/plain',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function guessMimeFromUrl(url: string): string | undefined {
	const m = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
	const ext = m?.[1];
	return ext ? MIME_BY_EXT[ext] : undefined;
}

function readNumberEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function fetchLocal(url: string, publicDir: string, maxBytes: number): Promise<FetchedDoc> {
	const safe = url.replace(/^\/+/, '').replace(/\.\./g, '');
	const fullPath = resolve(publicDir, safe);
	const buf = await readFile(fullPath);
	if (buf.byteLength > maxBytes) {
		throw new Error(`Файлът е твърде голям (${buf.byteLength} > ${maxBytes}): ${url}`);
	}
	return {
		url,
		bytes: new Uint8Array(buf),
		contentType: guessMimeFromUrl(url) ?? 'application/octet-stream',
		finalUrl: url,
		source: 'local',
	};
}

async function fetchRemote(
	url: string,
	timeoutMs: number,
	maxBytes: number,
): Promise<FetchedDoc> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			redirect: 'follow',
			headers: {
				'User-Agent':
					'SIMAContentIndexer/1.0 (public agro/legal docs; +https://agrinexus.eu.com)',
				Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.6',
			},
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} при изтегляне на ${url}`);
		}
		const declared = Number(res.headers.get('content-length') ?? '');
		if (Number.isFinite(declared) && declared > maxBytes) {
			throw new Error(`Content-Length ${declared} > maxBytes ${maxBytes}: ${url}`);
		}

		const reader = res.body?.getReader();
		if (!reader) {
			const buf = new Uint8Array(await res.arrayBuffer());
			if (buf.byteLength > maxBytes) {
				throw new Error(`Файлът е твърде голям (${buf.byteLength} > ${maxBytes}): ${url}`);
			}
			return {
				url,
				bytes: buf,
				contentType: res.headers.get('content-type')?.split(';')[0]?.trim() ??
					guessMimeFromUrl(url) ??
					'application/octet-stream',
				finalUrl: res.url || url,
				source: 'remote',
			};
		}

		const parts: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				try {
					await reader.cancel();
				} catch {
					/* ignore */
				}
				throw new Error(`Streaming прекъснат — над ${maxBytes} байта: ${url}`);
			}
			parts.push(value);
		}

		const bytes = new Uint8Array(total);
		let offset = 0;
		for (const p of parts) {
			bytes.set(p, offset);
			offset += p.byteLength;
		}

		return {
			url,
			bytes,
			contentType: res.headers.get('content-type')?.split(';')[0]?.trim() ??
				guessMimeFromUrl(url) ??
				'application/octet-stream',
			finalUrl: res.url || url,
			source: 'remote',
		};
	} finally {
		clearTimeout(t);
	}
}

/** Fetch a document by URL. Routes local `/docs/...` to filesystem, otherwise HTTP. */
export async function fetchDocument(
	url: string,
	opts: FetchOptions = {},
): Promise<FetchedDoc> {
	const timeoutMs =
		opts.timeoutMs ?? readNumberEnv('CONTENT_FETCH_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
	const maxBytes = opts.maxBytes ?? readNumberEnv('CONTENT_MAX_BYTES', DEFAULT_MAX_BYTES);
	const publicDir = opts.publicDir ?? resolve(process.cwd(), 'public');

	if (url.startsWith('/')) {
		return fetchLocal(url, publicDir, maxBytes);
	}
	if (/^https?:\/\//i.test(url)) {
		return fetchRemote(url, timeoutMs, maxBytes);
	}
	throw new Error(`Неподдържан URL формат: ${url}`);
}
