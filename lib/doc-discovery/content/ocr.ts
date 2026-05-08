/**
 * OCR fallback за scanned PDFs — извличане на текст през Tesseract.js (BG + EN).
 *
 * **Изключен по подразбиране** заради тежестта (изтегляне на ~10 MB езикови
 * данни при първи run + 5–10s/страница при разпознаване). Включи се с:
 *   RAG_OCR_ENABLED=1
 *
 * Активира се само когато pdfjs не извлича смислен текст (< RAG_OCR_MIN_TEXT_CHARS),
 * което автоматично хваща сканирани PDF-и без текстов слой.
 *
 * Pipeline: PDF → image-per-page (`pdf-to-img`, използва @napi-rs/canvas) →
 * Tesseract.recognize(page, 'bul+eng') → join.
 */
type RecognitionResult = { data: { text: string } };

type TesseractModule = {
	createWorker: (opts?: {
		langPath?: string;
		cachePath?: string;
		logger?: (m: { status?: string; progress?: number }) => void;
	}) => Promise<TesseractWorker>;
};

type TesseractWorker = {
	loadLanguage(langs: string): Promise<unknown>;
	initialize(langs: string): Promise<unknown>;
	reinitialize?(langs: string): Promise<unknown>;
	recognize(image: Buffer | Uint8Array): Promise<RecognitionResult>;
	terminate(): Promise<void>;
};

type PdfToImgIterable = AsyncIterable<{ name?: string; data?: Buffer } | Buffer>;

type PdfToImgModule = {
	pdf: (input: Buffer | Uint8Array, opts?: { scale?: number }) => Promise<PdfToImgIterable>;
};

const DEFAULT_LANGS = 'bul+eng';
const DEFAULT_MAX_PAGES = 30;

let cachedWorker: TesseractWorker | null = null;

export function isOcrEnabled(): boolean {
	const v = process.env.RAG_OCR_ENABLED?.trim().toLowerCase();
	return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function ocrMinTextChars(): number {
	const n = Number(process.env.RAG_OCR_MIN_TEXT_CHARS);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 200;
}

async function getWorker(): Promise<TesseractWorker> {
	if (cachedWorker) return cachedWorker;
	const tess = (await import('tesseract.js')) as unknown as TesseractModule;
	const worker = await tess.createWorker({
		logger: () => {
			/* silent — not piping progress to stdout */
		},
	});
	const langs = process.env.RAG_OCR_LANGS?.trim() || DEFAULT_LANGS;
	if (typeof worker.loadLanguage === 'function') {
		await worker.loadLanguage(langs);
	}
	await worker.initialize(langs);
	cachedWorker = worker;
	return worker;
}

export async function shutdownOcr(): Promise<void> {
	if (cachedWorker) {
		try {
			await cachedWorker.terminate();
		} catch {
			/* ignore */
		}
		cachedWorker = null;
	}
}

function pageToBuffer(page: { name?: string; data?: Buffer } | Buffer): Buffer | null {
	if (Buffer.isBuffer(page)) return page;
	if (page && typeof page === 'object' && 'data' in page && Buffer.isBuffer(page.data)) {
		return page.data;
	}
	return null;
}

export async function extractPdfTextWithOcr(bytes: Uint8Array): Promise<string> {
	const maxPages = Number(process.env.RAG_OCR_MAX_PAGES);
	const cap =
		Number.isFinite(maxPages) && maxPages > 0 ? Math.floor(maxPages) : DEFAULT_MAX_PAGES;
	const scale = Number(process.env.RAG_OCR_SCALE);
	const renderScale = Number.isFinite(scale) && scale > 0 ? scale : 2;

	const pdfToImg = (await import('pdf-to-img')) as unknown as PdfToImgModule;
	const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const pages = await pdfToImg.pdf(buf, { scale: renderScale });

	const worker = await getWorker();
	const out: string[] = [];
	let i = 0;
	for await (const page of pages) {
		if (i >= cap) break;
		i += 1;
		const img = pageToBuffer(page);
		if (!img) continue;
		try {
			const r = await worker.recognize(img);
			const text = (r.data?.text ?? '').trim();
			if (text.length > 0) out.push(text);
		} catch {
			/* skip a bad page; do not abort the whole document */
		}
	}
	return out.join('\n\n').trim();
}
