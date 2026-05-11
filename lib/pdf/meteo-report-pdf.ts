import { PDFDocument, rgb } from 'pdf-lib';
import type { WeatherForecastPayload } from '../weather-open-meteo.js';

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

function wmoLabel(lang: 'bg' | 'en', code: number): string {
	const bg: Record<number, string> = {
		0: 'ясно',
		1: 'предимно ясно',
		2: 'частична облачност',
		3: 'облачно',
		45: 'мъгла',
		48: 'мъгла',
		51: 'рязка ръмеж',
		53: 'ръмеж',
		55: 'силен ръмеж',
		61: 'дъжд',
		63: 'дъжд',
		65: 'силен дъжд',
		71: 'сняг',
		73: 'сняг',
		75: 'силен сняг',
		80: 'валежи',
		81: 'валежи',
		82: 'силни валежи',
		95: 'гръмотевична буря',
		96: 'буря с градушка',
		99: 'буря с градушка',
	};
	const en: Record<number, string> = {
		0: 'clear',
		1: 'mainly clear',
		2: 'partly cloudy',
		3: 'overcast',
		45: 'fog',
		48: 'fog',
		51: 'light drizzle',
		53: 'drizzle',
		55: 'dense drizzle',
		61: 'rain',
		63: 'rain',
		65: 'heavy rain',
		71: 'snow',
		73: 'snow',
		75: 'heavy snow',
		80: 'rain showers',
		81: 'rain showers',
		82: 'violent showers',
		95: 'thunderstorm',
		96: 'thunderstorm w/ hail',
		99: 'thunderstorm w/ hail',
	};
	const table = lang === 'bg' ? bg : en;
	return table[code] ?? `code ${code}`;
}

export type MeteoPdfInput = {
	lang: 'bg' | 'en';
	locationLabel: string;
	payload: WeatherForecastPayload;
	/** Optional Field Watch “financial effect” lines (filled in UI). */
	financialNotes?: { savedResource: string; riskFromDrought: string };
};

/** Shareable one-page PDF brief for advisors / coops / WhatsApp. */
export async function buildMeteoReportPdf(input: MeteoPdfInput): Promise<Uint8Array> {
	const { lang, locationLabel, payload, financialNotes } = input;
	const fontBytes = await loadNoto();
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(fontBytes, { subset: true });
	const page = pdfDoc.addPage([595, 842]);
	const { width, height } = page.getSize();
	let y = height - 48;

	const title =
		lang === 'bg'
			? 'SIMA — метео доклад (ориентир)'
			: 'SIMA — weather brief (orientation)';
	page.drawText(title, { x: 48, y, size: 14, font, color: rgb(0.05, 0.15, 0.12) });
	y -= 22;

	const meta =
		lang === 'bg'
			? [
					`Локация: ${locationLabel}`,
					`Координати: ${payload.latitude.toFixed(4)}°, ${payload.longitude.toFixed(4)}°`,
					`Часова зона: ${payload.timezone}`,
					`Генерирано (UTC): ${payload.generatedAt}`,
					`Източник: Open-Meteo (без ключ; не замества официална метео служба).`,
				]
			: [
					`Location: ${locationLabel}`,
					`Coordinates: ${payload.latitude.toFixed(4)}°, ${payload.longitude.toFixed(4)}°`,
					`Timezone: ${payload.timezone}`,
					`Generated (UTC): ${payload.generatedAt}`,
					`Source: Open-Meteo (no API key; not a substitute for national weather services).`,
				];

	for (const line of meta) {
		for (const chunk of wrapLines(line, 88)) {
			page.drawText(chunk, { x: 48, y, size: 9, font, color: rgb(0.12, 0.14, 0.16) });
			y -= 13;
		}
	}
	y -= 8;

	const savedTrim = financialNotes?.savedResource?.trim() ?? '';
	const riskTrim = financialNotes?.riskFromDrought?.trim() ?? '';
	if (savedTrim || riskTrim) {
		const finHead =
			lang === 'bg' ? 'Финансов ефект (ориентир, ръчни стойности)' : 'Financial effect (manual estimates)';
		page.drawText(finHead, { x: 48, y, size: 10, font, color: rgb(0.07, 0.35, 0.28) });
		y -= 14;
		const lines: string[] = [];
		if (savedTrim) {
			lines.push(
				lang === 'bg' ? `Спестен ресурс / избегнат разход: ${savedTrim}` : `Saved / avoided spend: ${savedTrim}`,
			);
		}
		if (riskTrim) {
			lines.push(lang === 'bg' ? `Риск / загуба: ${riskTrim}` : `Risk / loss: ${riskTrim}`);
		}
		for (const line of lines) {
			for (const chunk of wrapLines(line, 92)) {
				if (y < 140) break;
				page.drawText(chunk, { x: 48, y, size: 9, font, color: rgb(0.12, 0.14, 0.16) });
				y -= 13;
			}
		}
		y -= 6;
	}

	const cur = payload.current;
	const curHead = lang === 'bg' ? 'Текущи условия' : 'Current conditions';
	page.drawText(curHead, { x: 48, y, size: 11, font, color: rgb(0.07, 0.35, 0.28) });
	y -= 16;

	const curLines =
		lang === 'bg'
			? [
					`Час: ${cur.time}`,
					`Температура: ${cur.temperature_2m.toFixed(1)} °C (усеща се ${cur.apparent_temperature.toFixed(1)} °C)`,
					`Влажност: ${cur.relative_humidity_2m} %`,
					`Валеж (час): ${cur.precipitation.toFixed(1)} mm`,
					`Вятър: ${cur.wind_speed_10m.toFixed(1)} km/h, посока ${cur.wind_direction_10m}°`,
					`Налягане: ${cur.surface_pressure.toFixed(0)} hPa`,
					`Състояние: ${wmoLabel('bg', cur.weather_code)}`,
				]
			: [
					`Time: ${cur.time}`,
					`Temperature: ${cur.temperature_2m.toFixed(1)} °C (feels ${cur.apparent_temperature.toFixed(1)} °C)`,
					`Humidity: ${cur.relative_humidity_2m} %`,
					`Precipitation (hour): ${cur.precipitation.toFixed(1)} mm`,
					`Wind: ${cur.wind_speed_10m.toFixed(1)} km/h @ ${cur.wind_direction_10m}°`,
					`Pressure: ${cur.surface_pressure.toFixed(0)} hPa`,
					`Conditions: ${wmoLabel('en', cur.weather_code)}`,
				];

	for (const line of curLines) {
		for (const chunk of wrapLines(line, 92)) {
			if (y < 120) break;
			page.drawText(chunk, { x: 48, y, size: 9, font, color: rgb(0.1, 0.12, 0.14) });
			y -= 13;
		}
	}
	y -= 6;

	const dailyHead = lang === 'bg' ? 'Прогноза по дни (7)' : '7-day outlook';
	page.drawText(dailyHead, { x: 48, y, size: 11, font, color: rgb(0.07, 0.35, 0.28) });
	y -= 16;

	const d = payload.daily;
	const n = Math.min(7, d.time.length);
	for (let i = 0; i < n; i += 1) {
		const date = d.time[i];
		const tmax = d.temperature_2m_max[i];
		const tmin = d.temperature_2m_min[i];
		const rain = d.precipitation_sum[i];
		const pop = d.precipitation_probability_max[i];
		const w = d.weather_code[i];
		const gust = d.wind_speed_10m_max[i];
		const line =
			lang === 'bg'
				? `${date}: ${tmin.toFixed(0)}–${tmax.toFixed(0)} °C · ${rain.toFixed(1)} mm · POP ${pop}% · ${wmoLabel('bg', w)} · вятър до ${gust.toFixed(0)} km/h`
				: `${date}: ${tmin.toFixed(0)}–${tmax.toFixed(0)} °C · ${rain.toFixed(1)} mm · POP ${pop}% · ${wmoLabel('en', w)} · wind max ${gust.toFixed(0)} km/h`;
		for (const chunk of wrapLines(line, 92)) {
			if (y < 52) break;
			page.drawText(chunk, { x: 48, y, size: 8.5, font, color: rgb(0.12, 0.14, 0.16) });
			y -= 12;
		}
	}

	const foot =
		lang === 'bg'
			? 'Илюстративен ориентир за полски решения. Провери официални предупреждения и локална прогноза преди пръскане, прибиране и оросителни режими.'
			: 'Illustrative orientation for field decisions. Verify official warnings and local forecasts before spraying, harvest, and irrigation.';
	y = Math.min(y, 72);
	for (const chunk of wrapLines(foot, 94)) {
		page.drawText(chunk, { x: 48, y, size: 8, font, color: rgb(0.35, 0.38, 0.4) });
		y -= 11;
	}

	return pdfDoc.save();
}
