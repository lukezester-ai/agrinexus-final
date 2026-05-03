import { PDFDocument, rgb } from 'pdf-lib';
import type { FarmerLocalProfile } from '../farmer-profile-storage';

const NOTO_TTF =
	'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

function loadCyrillicFontBytes(): Promise<ArrayBuffer> {
	if (!fontBytesPromise) {
		fontBytesPromise = fetch(NOTO_TTF).then(r => {
			if (!r.ok) throw new Error('Failed to load Cyrillic font');
			return r.arrayBuffer();
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
	const { width, height } = page.getSize();
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
		`ЕГН / ЕИК: ${profile.uin || '…………………………'}`,
		`Стопанство: ${profile.farmName || '…………………………'}`,
		`Област / община: ${profile.region || '…………………………'}`,
		`Декларирана площ (дка): ${profile.decares || '…………………………'}`,
		`Банкова сметка (IBAN): ${profile.iban || '…………………………'}`,
		``,
		`Декларирам, че имам право да ползвам заявените площи и притежавам изискуемите документи по приложимите схеми.`,
		`Настоящата декларация е генерирана автоматично от AgriNexus за чернова — не подменя официални бланци и е-подпис в ИСУН.`,
	];
	await pageWithHeader(
		pdfDoc,
		'ДЕКЛАРАЦИЯ (образец за чернова)',
		body,
		'Този файл е с ориентировъчен характер. Провери текста със специалист и използвай актуални бланци от ДФЗ / ИСУН.',
	);
	return pdfDoc.save();
}

export async function buildApplicationSummaryPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`ОБОБЩЕНИЕ ЗА ЗАЯВЛЕНИЕ (чернова)`,
		`Кандидат: ${profile.fullName || '—'}`,
		`Идентификатор: ${profile.uin || '—'}`,
		`Стопанство: ${profile.farmName || '—'}; регион: ${profile.region || '—'}`,
		`Площ (дка): ${profile.decares || '—'}`,
		`IBAN: ${profile.iban || '—'}`,
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
		'Генерирано от AgriNexus. Не е подписан документ за държавни органи.',
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
		`Наемател: ${profile.fullName || '…………………………'} , ЕГН/ЕИК ${profile.uin || '………'}`,
		`Предмет: обработваеми земеделски земи в област ${profile.region || '………'}`,
		`Срок: от ……… до ………`,
		`Размер на наема: ……… лв./година или % от продукцията.`,
		`Плащане: по банков път IBAN ${profile.iban || '………'}`,
		``,
		`Страните се задължават да спазват законовите изисквания за ползване на земята и кръстосъответствие.`,
		`Подписи: ................................. / .................................`,
	];
	await pageWithHeader(
		pdfDoc,
		'ДОГОВОР — чернова',
		body,
		'Образец за преговори. Задължителен преглед от юрист. AgriNexus не носи отговорност за съдържанието.',
	);
	return pdfDoc.save();
}

export async function buildStatementPdf(profile: FarmerLocalProfile): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const body = [
		`СПРАВКА ЗА СТОПАНСКИ ДАННИ (чернова)`,
		`Дата на генериране: ${new Date().toLocaleString('bg-BG')}`,
		`Производител: ${profile.fullName || '—'}`,
		`ЕГН/ЕИК: ${profile.uin || '—'}`,
		`Стопанство: ${profile.farmName || '—'}`,
		`Регион: ${profile.region || '—'}`,
		`Обща площ (дка): ${profile.decares || '—'}`,
		`Банкова сметка: ${profile.iban || '—'}`,
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
	const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
