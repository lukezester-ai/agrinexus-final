/**
 * Извличане на текст от PDF чрез pdfjs-dist (Mozilla).
 *
 * Ползва legacy build за Node ESM съвместимост — няма зависимост от DOM/canvas.
 * Тихо игнорира страници с image-only съдържание (OCR не правим тук).
 */
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfDocumentLike = {
	numPages: number;
	getPage(pageNumber: number): Promise<{
		getTextContent(opts?: { disableCombineTextItems?: boolean }): Promise<{
			items: TextItem[];
		}>;
		cleanup?: () => void;
	}>;
	destroy?: () => Promise<void> | void;
};

const MAX_PAGES = 200;

function joinTextItems(items: TextItem[]): string {
	const lines: string[] = [];
	let buffer: string[] = [];
	for (const it of items) {
		if (typeof it.str !== 'string') continue;
		buffer.push(it.str);
		if (it.hasEOL) {
			lines.push(buffer.join(''));
			buffer = [];
		}
	}
	if (buffer.length > 0) lines.push(buffer.join(''));
	return lines.join('\n');
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
	const loadingTask = (
		pdfjs as unknown as {
			getDocument: (params: {
				data: Uint8Array;
				disableFontFace: boolean;
				useSystemFonts: boolean;
			}) => { promise: Promise<PdfDocumentLike> };
		}
	).getDocument({
		data: bytes,
		disableFontFace: true,
		useSystemFonts: false,
	});
	const doc = await loadingTask.promise;

	try {
		const totalPages = Math.min(doc.numPages, MAX_PAGES);
		const pageTexts: string[] = [];
		for (let p = 1; p <= totalPages; p++) {
			const page = await doc.getPage(p);
			try {
				const tc = await page.getTextContent({ disableCombineTextItems: false });
				const text = joinTextItems(tc.items as TextItem[]).trim();
				if (text.length > 0) pageTexts.push(text);
			} finally {
				try {
					page.cleanup?.();
				} catch {
					/* ignore */
				}
			}
		}
		return pageTexts.join('\n\n').trim();
	} finally {
		try {
			await doc.destroy?.();
		} catch {
			/* ignore */
		}
	}
}
