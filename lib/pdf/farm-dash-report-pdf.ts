import { PDFDocument, rgb } from 'pdf-lib';
import type { FarmDashPersisted, FieldTileStatus } from '../farm-dash-schema.js';
import type { FarmDashWeatherSnap } from '../open-meteo-farm-dash.js';

const NOTO_TTF =
	'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

async function loadNoto(): Promise<ArrayBuffer> {
	if (!fontBytesPromise) {
		fontBytesPromise = fetch(NOTO_TTF).then(r => {
			if (!r.ok) throw new Error('Failed to load font for PDF');
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

function countStatuses(fields: FarmDashPersisted['fields']): Record<FieldTileStatus, number> {
	const init: Record<FieldTileStatus, number> = {
		great: 0,
		good: 0,
		warn: 0,
		critical: 0,
		rest: 0,
	};
	for (const r of fields) init[r.status] += 1;
	return init;
}

const BG_STATUS: Record<FieldTileStatus, string> = {
	great: 'Отличен',
	good: 'Добър',
	warn: 'Внимание',
	critical: 'Критичен',
	rest: 'Почивка',
};

const EN_STATUS: Record<FieldTileStatus, string> = {
	great: 'Excellent',
	good: 'Good',
	warn: 'Attention',
	critical: 'Critical',
	rest: 'Fallow',
};

export type FarmDashReportPdfInput = {
	lang: 'bg' | 'en';
	dash: FarmDashPersisted;
	weather: FarmDashWeatherSnap | null;
};

/** PDF доклад за локалното Operations табло (полета + серии + опционално метео). */
export async function buildFarmDashReportPdf(input: FarmDashReportPdfInput): Promise<Uint8Array> {
	const { lang, dash, weather } = input;
	const fontBytes = await loadNoto();
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(fontBytes, { subset: true });
	let page = pdfDoc.addPage([595, 842]);
	const { width, height } = page.getSize();
	let y = height - 48;
	const left = 48;
	const lineGap = 13;
	const bodySize = 10;

	const draw = (text: string, size = bodySize, bold = false) => {
		const lines = wrapLines(text, 92);
		for (const ln of lines) {
			if (y < 56) {
				page = pdfDoc.addPage([595, 842]);
				y = height - 48;
			}
			page.drawText(ln, {
				x: left,
				y,
				size: bold ? size + 1 : size,
				font,
				color: rgb(0.06, 0.09, 0.08),
			});
			y -= lineGap;
		}
	};

	const title =
		lang === 'bg'
			? 'SIMA — Operations табло (PDF доклад)'
			: 'SIMA — Operations dashboard (PDF report)';
	page.drawText(title, { x: left, y, size: 14, font, color: rgb(0.05, 0.15, 0.12) });
	y -= 22;

	draw(
		lang === 'bg'
			? `Генерирано (UTC): ${new Date().toISOString()} · Данните са локални за браузъра (localStorage).`
			: `Generated (UTC): ${new Date().toISOString()} · Data is local to this browser (localStorage).`,
		9,
	);

	const counts = countStatuses(dash.fields);
	const critIds = dash.fields.filter(f => f.status === 'critical').map(f => String(f.id));
	const warnIds = dash.fields.filter(f => f.status === 'warn').map(f => String(f.id));
	const labels = lang === 'bg' ? BG_STATUS : EN_STATUS;

	y -= 6;
	draw(lang === 'bg' ? '— Полета по статус —' : '— Fields by status —', 11, true);
	for (const k of Object.keys(counts) as FieldTileStatus[]) {
		draw(`${labels[k]}: ${counts[k]}`, bodySize);
	}
	draw(
		lang === 'bg'
			? `Критични (ID): ${critIds.length ? critIds.join(', ') : '—'}`
			: `Critical (IDs): ${critIds.length ? critIds.join(', ') : '—'}`,
	);
	draw(
		lang === 'bg'
			? `Внимание (ID): ${warnIds.length ? warnIds.join(', ') : '—'}`
			: `Warning (IDs): ${warnIds.length ? warnIds.join(', ') : '—'}`,
	);

	y -= 4;
	draw(lang === 'bg' ? '— Дялове култури (тегла) —' : '— Crop share weights —', 11, true);
	draw(`Wheat / Maize / Sunflower / Rapeseed: ${dash.cropShares.join(' · ')}`);

	const moistAvg = (dash.moisture.reduce((s, x) => s + x, 0) / dash.moisture.length).toFixed(1);
	draw(lang === 'bg' ? '— Влажност —' : '— Moisture —', 11, true);
	draw(
		lang === 'bg'
			? `Средна (7 дни): ${moistAvg}% · Целева линия: ${dash.moistureTarget}% · Серия: ${dash.moisture.join(', ')}`
			: `Avg (7d): ${moistAvg}% · Target line: ${dash.moistureTarget}% · Series: ${dash.moisture.join(', ')}`,
	);

	y -= 4;
	draw(lang === 'bg' ? '— Реколта по месеци (т), сборно по култури —' : '— Monthly harvest (t), by crop —', 11, true);
	for (let i = 0; i < 7; i += 1) {
		const m = lang === 'bg' ? ['Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт'][i] : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i];
		const w = dash.harvestMonthly.wheat[i];
		const mz = dash.harvestMonthly.maize[i];
		const sf = dash.harvestMonthly.sunflower[i];
		draw(`${m}: wheat ${w}, maize ${mz}, sunflower ${sf}`);
	}

	y -= 4;
	draw(lang === 'bg' ? '— Годишни редове (таб Реколта) —' : '— Annual bars (Harvest tab) —', 11, true);
	draw(`2026: ${dash.harvestYears.y2026.join(', ')}`);
	draw(`2025: ${dash.harvestYears.y2025.join(', ')}`);
	draw(`2024: ${dash.harvestYears.y2024.join(', ')}`);
	draw(`${lang === 'bg' ? 'Топ полета (т)' : 'Top fields (t)'}: ${dash.topFields.join(', ')}`);
	draw(`${lang === 'bg' ? 'Общо по месеци (т)' : 'Monthly totals (t)'}: ${dash.harvestTrend.join(', ')}`);

	y -= 6;
	draw(lang === 'bg' ? '— Метео (Open-Meteo) —' : '— Weather (Open-Meteo) —', 11, true);
	draw(
		lang === 'bg'
			? `Зададени координати: ${dash.weatherLat.toFixed(4)}°, ${dash.weatherLon.toFixed(4)}°`
			: `Coordinates: ${dash.weatherLat.toFixed(4)}°, ${dash.weatherLon.toFixed(4)}°`,
	);
	if (weather) {
		draw(
			lang === 'bg'
				? `Текущо: ${Math.round(weather.temp)}°C · Усеща се ${Math.round(weather.feels)}°C · Влажност ${weather.humidity}% · Вятър ${Math.round(weather.wind)} km/h · Налягане ${Math.round(weather.pressure)} hPa · Валеж ${weather.rain.toFixed(1)} mm · UV ${weather.uv.toFixed(1)} · код ${weather.code}`
				: `Now: ${Math.round(weather.temp)}°C · Feels ${Math.round(weather.feels)}°C · RH ${weather.humidity}% · Wind ${Math.round(weather.wind)} km/h · Pressure ${Math.round(weather.pressure)} hPa · Rain ${weather.rain.toFixed(1)} mm · UV ${weather.uv.toFixed(1)} · code ${weather.code}`,
		);
		draw(lang === 'bg' ? '7-дневна решетка (макс / мин °C, валеж мм):' : '7-day grid (max / min °C, rain mm):');
		const { daily } = weather;
		for (let i = 0; i < Math.min(7, daily.time.length); i += 1) {
			const tmax = Math.round(daily.temperature_2m_max[i]);
			const tmin = Math.round(daily.temperature_2m_min[i]);
			const rain = Number(daily.precipitation_sum[i]).toFixed(1);
			draw(`${daily.time[i]}: ${tmax} / ${tmin} °C · ${rain} mm`);
		}
	} else {
		draw(
			lang === 'bg'
				? 'Няма заредени метео данни в този PDF — отворете таб „Времето“ или „Обнови метео“ преди експорт.'
				: 'No weather snapshot in this PDF — open the Weather tab or refresh weather before export.',
		);
	}

	y -= 8;
	draw(
		lang === 'bg'
			? 'Източник на метео: Open-Meteo (без API ключ). Не замества официална метео служба. Графиките в PDF са описани като числа; не включват изображения на диаграмите.'
			: 'Weather source: Open-Meteo (no API key). Does not replace official weather services. Charts are summarized as numbers; diagram images are not embedded.',
		9,
	);

	return pdfDoc.save();
}
