import { PDFDocument, rgb } from 'pdf-lib';
import type { FarmerLocalProfile } from '../farmer-profile-storage';

/** Резерв, ако локалният файл в `public/fonts/` липсва (стари билдове). */
const NOTO_TTF_CDN =
	'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

function fontUrlsInOrder(): string[] {
	const base = import.meta.env.BASE_URL;
	const root = base.endsWith('/') ? base : `${base}/`;
	return [`${root}fonts/NotoSans-Regular.ttf`, NOTO_TTF_CDN];
}

async function fetchFontFromUrl(url: string): Promise<ArrayBuffer> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`Font HTTP ${r.status}`);
	return r.arrayBuffer();
}

/** Зарежда Noto за кирилица: първо от същия хост (без външна мрежа), после CDN; при грешка кешът се нулира за повторен опит. */
function loadCyrillicFontBytes(): Promise<ArrayBuffer> {
	if (!fontBytesPromise) {
		fontBytesPromise = (async () => {
			let lastErr: unknown;
			for (const url of fontUrlsInOrder()) {
				for (let attempt = 0; attempt < 2; attempt += 1) {
					try {
						return await fetchFontFromUrl(url);
					} catch (e) {
						lastErr = e;
						if (attempt === 0) await new Promise<void>(res => window.setTimeout(res, 400));
					}
				}
			}
			throw lastErr instanceof Error ? lastErr : new Error('Failed to load Cyrillic font');
		})().catch(err => {
			fontBytesPromise = null;
			throw err;
		});
	}
	return fontBytesPromise;
}

function wrapLines(text: string, maxChars: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let cur = '';
	for (const w of words) {
		if (!w) continue;
		const next = cur ? `${cur} ${w}` : w;
		if (next.length <= maxChars) cur = next;
		else {
			if (cur) lines.push(cur);
			cur = w.length > maxChars ? w.slice(0, maxChars) : w;
		}
	}
	if (cur) lines.push(cur);
	return lines.length ? lines : [''];
}

async function pageWithHeader(
	pdfDoc: PDFDocument,
	title: string,
	bodyLines: string[],
	footerNote: string,
): Promise<void> {
	const fontBytes = await loadCyrillicFontBytes();
	const font = await pdfDoc.embedFont(fontBytes, { subset: true });
	const page = pdfDoc.addPage([595, 842]);
	const { height } = page.getSize();
	let y = height - 56;
	page.drawText(title, { x: 48, y, size: 14, font, color: rgb(0.05, 0.15, 0.12) });
	y -= 28;
	for (const line of bodyLines) {
		for (const chunk of wrapLines(line, 85)) {
			if (y < 100) break;
			page.drawText(chunk, { x: 48, y, size: 10, font, color: rgb(0.1, 0.12, 0.14) });
			y -= 14;
		}
	}
	y = 72;
	for (const chunk of wrapLines(footerNote, 90)) {
		page.drawText(chunk, { x: 48, y, size: 8, font, color: rgb(0.35, 0.38, 0.4) });
		y -= 11;
	}
}

/** Декларация — образец за попълване (не е официален бланк на ДФЗ). */
export async function buildDeclarationPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`Декларирам, че данните по-долу са верни към датата на подписване:`,
		`Име и фамилия / представляващ: ${profile.fullName || '…………………………'}`,
		`Стопанство: ${profile.farmName || '…………………………'}`,
		`Област / община: ${profile.region || '…………………………'}`,
		`Декларирана площ (дка): ${profile.decares || '…………………………'}`,
		``,
		`Идентификатор и банкови реквизити се попълват само в официални бланки и в ИСУН — не се съхраняват в AgriNexus.`,
		``,
		`Декларирам, че имам право да ползвам заявените площи и притежавам изискуемите документи по приложимите схеми.`,
		`Настоящата декларация е генерирана автоматично от SIMA за чернова — не подменя официални бланци и е-подпис в ИСУН.`,
	];
	await pageWithHeader(
		pdfDoc,
		'ДЕКЛАРАЦИЯ (образец за чернова)',
		body,
		'Този файл е с ориентировъчен характер. Провери текста със специалист и използвай актуални бланки от ДФЗ / ИСУН.',
	);
	return pdfDoc.save();
}

export async function buildApplicationSummaryPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`ОБОБЩЕНИЕ ЗА ЗАЯВЛЕНИЕ (чернова)`,
		`Кандидат: ${profile.fullName || '—'}`,
		`Стопанство: ${profile.farmName || '—'}; регион: ${profile.region || '—'}`,
		`Площ (дка): ${profile.decares || '—'}`,
		``,
		`Документи (отметки от профила):`,
		`- Право на ползване на земя: ${profile.hasLandRightsDoc ? 'да' : 'не'}`,
		`- Потвърдена сметка ДФЗ: ${profile.hasBankAccountVerified ? 'да' : 'не'}`,
		`- Био/екосхема декларирана: ${profile.declaresOrganic ? 'да' : 'не'}`,
		`- Валиден био сертификат: ${profile.hasOrganicCertificate ? 'да' : 'не'}`,
		``,
		`Прикачи към това обобщение официалните приложения и подай през ИСУН.`,
	];
	await pageWithHeader(
		pdfDoc,
		'ЗАЯВЛЕНИЕ — обобщение',
		body,
		'Генерирано от SIMA. Не е подписан документ за държавни органи.',
	);
	return pdfDoc.save();
}

export async function buildLeaseContractDraftPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`ДОГОВОР ЗА АРЕНДА НА ЗЕМЕДЕЛСКА ЗЕМЯ (ЧЕРНОВА)`,
		`между страните, съставен за ориентация. Попълни номера на имоти и срок по Наредба 14 и гражданския кодекс.`,
		``,
		`Наемодател: …………………………………………………………`,
		`Наемател: ${profile.fullName || '…………………………'}`,
		`Предмет: обработваеми земеделски земи в област ${profile.region || '………'}`,
		`Срок: от ……… до ………`,
		`Размер на наема: ……… лв./година или % от продукцията.`,
		`Плащане: по банков път — условията се уточняват в окончателния договор между страните.`,
		``,
		`Страните се задължават да спазват законовите изисквания за ползване на земята и кръстосъответствие.`,
		`Подписи: ................................. / .................................`,
	];
	await pageWithHeader(
		pdfDoc,
		'ДОГОВОР — чернова',
		body,
		'Образец за преговори. Задължителен преглед от юрист. SIMA не носи отговорност за съдържанието.',
	);
	return pdfDoc.save();
}

export async function buildStatementPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`СПРАВКА ЗА СТОПАНСКИ ДАННИ (чернова)`,
		`Дата на генериране: ${new Date().toLocaleString('bg-BG')}`,
		`Производител: ${profile.fullName || '—'}`,
		`Стопанство: ${profile.farmName || '—'}`,
		`Регион: ${profile.region || '—'}`,
		`Обща площ (дка): ${profile.decares || '—'}`,
		``,
		`Справката е предназначена за вътрешна употреба и приложение към банка / доставчик / партньор.`,
	];
	await pageWithHeader(
		pdfDoc,
		'СПРАВКА',
		body,
		'Не е официален документ на държавна институция.',
	);
	return pdfDoc.save();
}

/** Обединен PDF — четири страници. */
export async function buildDocumentPackPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const dec = await buildDeclarationPdf(profile);
	const app = await buildApplicationSummaryPdf(profile);
	const lease = await buildLeaseContractDraftPdf(profile);
	const stmt = await buildStatementPdf(profile);

	const merged = await PDFDocument.create();
	for (const bytes of [dec, app, lease, stmt]) {
		const src = await PDFDocument.load(bytes);
		const pages = await merged.copyPages(src, src.getPageIndices());
		for (const p of pages) merged.addPage(p);
	}
	return merged.save();
}

export function downloadPdfBytes(data: Uint8Array, filename: string): void {
	const copy = Uint8Array.from(data);
	const blob = new Blob([copy], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
