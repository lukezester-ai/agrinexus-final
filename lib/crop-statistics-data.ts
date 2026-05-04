import type { UiLang } from './i18n';

export type Localized = { bg: string; en: string };

export type CropKey =
	| 'wheat_barley'
	| 'sunflower'
	| 'maize'
	| 'tomatoes'
	| 'grapes'
	| 'apples';

export function pickL(t: Localized, lang: UiLang): string {
	if (lang === 'bg') return t.bg;
	return t.en;
}

/** Production in thousand tonnes (хил. т) — илюстративни стойности за демо графика. */
export type YearPoint = { year: number; kt: number };

/** Индикативни EUR/t (по същите години като series). Изкупни МЗХ/САПИ (оперативни); едро — ДКСБТ тържища (годишни средни за 2024–2025 от бюлетин ян. 2026); зърно 2025 — CBOT в същия бюлетин; по-стари години — прокси. */
export type YearPricePoint = { year: number; eurPerTonne: number };

/** Официален фиксиран курс: 1 EUR = 1.95583 BGN */
const BGN_PER_EUR = 1.95583;

/** Едро в лв./kg от наблюденията на тържищата → EUR/t за графиката в приложението */
function wholesaleBgnPerKgToEurPerT(bgnPerKg: number): number {
	return Math.round((bgnPerKg * 1000) / BGN_PER_EUR);
}

/** Средни изкупни цени в лв./t (без ДДС, напр. САПИ) → EUR/t при фиксиран курс BGN/EUR */
function purchaseBgnPerTonneToEurPerT(bgnPerTonne: number): number {
	return Math.round(bgnPerTonne / BGN_PER_EUR);
}

/** Котировки в USD/t (напр. Chicago) → EUR/t с опростен обменен курс към момента на бюлетина */
function usdPerTToEurPerTRough(usdPerT: number, usdEur = 0.923): number {
	return Math.round(usdPerT * usdEur);
}

export type CropProfile = {
	key: CropKey;
	chartColor: string;
	label: Localized;
	/** Производство (хил. т) за последните 5 завършени кампании */
	series: YearPoint[];
	/** Примерни средни нива EUR/t за същата петилетка */
	priceSeries: YearPricePoint[];
	genNotes: Localized;
	irrigationGeneral: Localized;
	irrigationIfDry: Localized;
};

function linearYearValueForecast(rows: { year: number; value: number }[]): {
	nextYear: number;
	forecastValue: number;
	slopePerYear: number;
	intercept: number;
} {
	const ys = rows.map(r => r.year);
	const vs = rows.map(r => r.value);
	const n = ys.length;
	let sx = 0,
		sy = 0,
		sxx = 0,
		sxy = 0;
	for (let i = 0; i < n; i++) {
		sx += ys[i];
		sy += vs[i];
		sxx += ys[i] * ys[i];
		sxy += ys[i] * vs[i];
	}
	const den = n * sxx - sx * sx;
	const b = den === 0 ? 0 : (n * sxy - sx * sy) / den;
	const a = (sy - b * sx) / n;
	const nextYear = ys[n - 1] + 1;
	const forecastValue = a + b * nextYear;
	return { nextYear, forecastValue, slopePerYear: b, intercept: a };
}

/** Линейна регресия върху добива → прогноза хил. т за следващата година */
export function forecastProductionKt(series: YearPoint[]): {
	nextYear: number;
	forecastKt: number;
	slopeKtPerYear: number;
	intercept: number;
} {
	const r = linearYearValueForecast(series.map(p => ({ year: p.year, value: p.kt })));
	return {
		nextYear: r.nextYear,
		forecastKt: Math.max(0, r.forecastValue),
		slopeKtPerYear: r.slopePerYear,
		intercept: r.intercept,
	};
}

/** Линейна екстраполация на EUR/t за следващата кампания */
export function forecastPriceEurPerT(priceSeries: YearPricePoint[]): {
	nextYear: number;
	forecastEurPerT: number;
	slopeEurPerYear: number;
	intercept: number;
} {
	const r = linearYearValueForecast(priceSeries.map(p => ({ year: p.year, value: p.eurPerTonne })));
	return {
		nextYear: r.nextYear,
		forecastEurPerT: Math.max(1, r.forecastValue),
		slopeEurPerYear: r.slopePerYear,
		intercept: r.intercept,
	};
}

/** Средна EUR/t по демо серията */
export function averagePriceEurPerT(priceSeries: YearPricePoint[]): number {
	if (priceSeries.length === 0) return 0;
	const s = priceSeries.reduce((a, p) => a + p.eurPerTonne, 0);
	return s / priceSeries.length;
}

/**
 * Опростена ценова корекция спрямо прогнозния добив vs средния добив:
 * по-нисък обем → леко по-висока индикативна цена в модела и обратно.
 */
export function adjustPriceByProductionOutlook(
	trendPriceEur: number,
	forecastKt: number,
	avgKt: number,
): number {
	if (avgKt <= 0 || forecastKt <= 0 || trendPriceEur <= 0) return trendPriceEur;
	const relSupplyGap = (forecastKt - avgKt) / avgKt;
	const adj = Math.max(-0.12, Math.min(0.12, -relSupplyGap * 0.35));
	return Math.round(trendPriceEur * (1 + adj));
}

/** Хевристика: „суха“ година ако наклонът е отрицателен или последният добив е с >8% под предходния */
export function isDryStressLikely(series: YearPoint[], slope: number): boolean {
	if (slope < -2) return true;
	const last = series[series.length - 1]?.kt;
	const prev = series[series.length - 2]?.kt;
	if (last != null && prev != null && prev > 0 && last < prev * 0.92) return true;
	return false;
}

/** Коефициент на вариация σ/μ по серията kt — колко „рискова“ е година спрямо година. */
export function coefficientOfVariationKt(values: number[]): number {
	if (values.length < 2) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	if (mean === 0) return 0;
	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance) / mean;
}

export type OutlookFactor =
	| 'trend_down'
	| 'trend_up'
	| 'dry_heuristic'
	| 'forecast_below_avg'
	| 'forecast_above_avg'
	| 'high_volatility';

export const OUTLOOK_FACTOR_LABELS: Record<OutlookFactor, Localized> = {
	trend_down: {
		bg: 'отрицателен наклон на тенденцията в примерните данни (спад обем при екстраполация)',
		en: 'negative slope in the demo trend (declining volumes if extrapolated)',
	},
	trend_up: {
		bg: 'положителен наклон на тенденцията в примерните данни',
		en: 'positive slope in the demo trend',
	},
	dry_heuristic: {
		bg: 'сигнал за суша по евристика (рязък спад последна спрямо предходна година или стръмен отрицателен наклон)',
		en: 'dry-pattern heuristic (sharp drop vs prior year or steep negative slope)',
	},
	forecast_below_avg: {
		bg: 'прогнозният обем е под средното на петте години в серията',
		en: 'forecast volume sits below the five-year demo average',
	},
	forecast_above_avg: {
		bg: 'прогнозният обем е над средното на петте години в серията',
		en: 'forecast volume sits above the five-year demo average',
	},
	high_volatility: {
		bg: 'големи колебания между годините (непостоянен добив в примерните данни)',
		en: 'large year-to-year swings (uneven harvest in the demo series)',
	},
};

export const OUTLOOK_FACTORS_NONE: Localized = {
	bg: 'няма отделни сигнали извън малки отклонения от средното — картината е умерена.',
	en: 'no standout signals beyond small deviations from average — a moderate picture.',
};

export type CropOutlookAnalysis = {
	lastYear: number;
	lastKt: number;
	minKt: number;
	maxKt: number;
	minYear: number;
	maxYear: number;
	avgKt: number;
	pctVsLast: number;
	pctVsAvg: number;
	cvSeries: number;
	factors: OutlookFactor[];
	tone: 'headwind' | 'tailwind' | 'mixed';
};

export function analyzeCropOutlook(
	series: YearPoint[],
	slopeKtPerYear: number,
	forecastKt: number,
	dry: boolean,
): CropOutlookAnalysis {
	const n = series.length;
	const last = series[n - 1];
	const lastKt = last.kt;
	const lastYear = last.year;
	const kts = series.map(p => p.kt);
	const avgKt = kts.reduce((a, b) => a + b, 0) / n;
	const pctVsLast = lastKt === 0 ? 0 : ((forecastKt - lastKt) / lastKt) * 100;
	const pctVsAvg = avgKt === 0 ? 0 : ((forecastKt - avgKt) / avgKt) * 100;
	const cvSeries = coefficientOfVariationKt(kts);

	let minPt = series[0];
	let maxPt = series[0];
	for (const p of series) {
		if (p.kt < minPt.kt) minPt = p;
		if (p.kt > maxPt.kt) maxPt = p;
	}

	const relSlope = avgKt > 0 ? slopeKtPerYear / avgKt : 0;

	const factors: OutlookFactor[] = [];
	if (relSlope < -0.007) factors.push('trend_down');
	if (relSlope > 0.007) factors.push('trend_up');
	if (dry) factors.push('dry_heuristic');
	if (forecastKt < avgKt * 0.988) factors.push('forecast_below_avg');
	if (forecastKt > avgKt * 1.012) factors.push('forecast_above_avg');
	if (cvSeries > 0.055) factors.push('high_volatility');

	const hard =
		dry ||
		relSlope < -0.011 ||
		(forecastKt < avgKt * 0.985 && pctVsLast < -1.5);
	const easy =
		!dry &&
		relSlope > 0.011 &&
		forecastKt > avgKt * 1.01 &&
		pctVsLast >= -0.5;

	let tone: CropOutlookAnalysis['tone'];
	if (hard && !easy) tone = 'headwind';
	else if (easy && !hard) tone = 'tailwind';
	else tone = 'mixed';

	if (factors.length === 0) tone = 'mixed';

	return {
		lastYear,
		lastKt,
		minKt: minPt.kt,
		maxKt: maxPt.kt,
		minYear: minPt.year,
		maxYear: maxPt.year,
		avgKt,
		pctVsLast,
		pctVsAvg,
		cvSeries,
		factors,
		tone,
	};
}

/**
 * Цени EUR/t: 2023–2024 зърно/слънчоглед/царевица — изкупни САПИ (МЗХ оперативен анализ №46/2024).
 * 2025 зърно/царевица — ориентир Chicago maize/wheat от ДКСБТ годишен бюлетин за 2025 г. (София, януари 2026).
 * Домати — средногодишни едро лв./kg по консолидирания ред „ДОМАТИ“ (не само оранжерия); ябълки — същата таблица.
 * По-ранни години при доматите — гладък ориентир; грозде — сезонни графики ДКСБТ. BGN→EUR: фиксиран курс.
 * Добивите (series) са демо за UI.
 */
export const CROP_PROFILES: CropProfile[] = [
	{
		key: 'wheat_barley',
		chartColor: '#c9a227',
		label: {
			bg: 'Пшеница и ечемик (общо)',
			en: 'Wheat & barley (combined)',
		},
		series: [
			{ year: 2021, kt: 5980 },
			{ year: 2022, kt: 6310 },
			{ year: 2023, kt: 6145 },
			{ year: 2024, kt: 6420 },
			{ year: 2025, kt: 6280 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: usdPerTToEurPerTRough(235) },
			{ year: 2022, eurPerTonne: usdPerTToEurPerTRough(310) },
			{
				year: 2023,
				eurPerTonne: Math.round(
					(purchaseBgnPerTonneToEurPerT(385) + purchaseBgnPerTonneToEurPerT(342)) / 2,
				),
			},
			{
				year: 2024,
				eurPerTonne: Math.round(
					(purchaseBgnPerTonneToEurPerT(390) + purchaseBgnPerTonneToEurPerT(364)) / 2,
				),
			},
			{ year: 2025, eurPerTonne: usdPerTToEurPerTRough(205) },
		],
		genNotes: {
			bg: 'Зърното доминира в Добруджа и горнотракийската низина; 2023–2024 — изкупни САПИ (МЗХ бюл. №46/2024); 2025 — ориентир към графиката Chicago wheat в ДКСБТ годишен бюлетин за 2025 г.; другите години — прокси; добивът е демо.',
			en: 'Grain in Dobruja & Upper Thrace; 2023–2024 from SAP purchases (MA bulletin 46/2024); 2025 tracks CBOT wheat chart in DKSBТ annual bulletin for 2025 (Jan 2026); other years are proxies; harvest tonnes are demo.',
		},
		irrigationGeneral: {
			bg: 'При зърнено обикновено се разчита на валежи; напояването е ограничено, но напръскване при горещ етап на пшеницата и подпомагане при „фиданкови“ посеви на царевица/слънчоглед по поречия.',
			en: 'Rainfed dominates for cereals; irrigation is limited — consider supplemental water for critical stages or downstream crops in valleys.',
		},
		irrigationIfDry: {
			bg: 'При суша: приоритет на напояване в Добруджа и Източна България (по-ниски валежи през пролетта), както и по Черноморското крайбрежие при дефицит на влага при закласяване.',
			en: 'In dry spells: prioritise irrigated blocks in Dobruja & eastern Bulgaria, plus coastal strips if moisture fails during grain fill.',
		},
	},
	{
		key: 'sunflower',
		chartColor: '#f4b400',
		label: {
			bg: 'Слънчоглед',
			en: 'Sunflower',
		},
		series: [
			{ year: 2021, kt: 1680 },
			{ year: 2022, kt: 1820 },
			{ year: 2023, kt: 1755 },
			{ year: 2024, kt: 1890 },
			{ year: 2025, kt: 1780 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: 382 },
			{ year: 2022, eurPerTonne: 498 },
			{ year: 2023, eurPerTonne: purchaseBgnPerTonneToEurPerT(688) },
			{ year: 2024, eurPerTonne: purchaseBgnPerTonneToEurPerT(1076) },
			{ year: 2025, eurPerTonne: 418 },
		],
		genNotes: {
			bg: 'Слънчогледът е чувствителен на влага; семена 2023–2024 — изкупни САПИ (МЗХ бюл. №46/2024); годишният бюлетин на ДКСБТ за 2025 г. детайлизира главно слънчогледово олио (Ротердам) — редът за семена след 2024 остава прокси; добивът е демо.',
			en: 'Moisture-sensitive; 2023–2024 seed purchases from SAP (MA bulletin 46/2024); DKSBТ’s 2025 annual bulletin focuses on sunflower oil (Rotterdam) — post-2024 seed EUR stays a proxy row; harvest tonnes are demo.',
		},
		irrigationGeneral: {
			bg: 'При напояване: равномерна влага по време на цъфтеж; избягване на преполиване преди жътва.',
			en: 'If irrigating: keep even moisture through flowering; avoid waterlogging before harvest.',
		},
		irrigationIfDry: {
			bg: 'Сухо: силно засегнати са лесните почви в Северна България и участъци без задържане на влага — подпомагане на инвазионни полета по Янтра, Осъм, Дунавска равнина.',
			en: 'Dry years: lighter soils in northern Bulgaria suffer first — prioritise fields along Yantra, Osam and Danube plain corridors.',
		},
	},
	{
		key: 'maize',
		chartColor: '#e8c547',
		label: {
			bg: 'Царевица',
			en: 'Maize',
		},
		series: [
			{ year: 2021, kt: 2100 },
			{ year: 2022, kt: 2380 },
			{ year: 2023, kt: 2240 },
			{ year: 2024, kt: 2510 },
			{ year: 2025, kt: 2395 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: usdPerTToEurPerTRough(178) },
			{ year: 2022, eurPerTonne: usdPerTToEurPerTRough(248) },
			{ year: 2023, eurPerTonne: purchaseBgnPerTonneToEurPerT(372) },
			{ year: 2024, eurPerTonne: purchaseBgnPerTonneToEurPerT(376) },
			{ year: 2025, eurPerTonne: usdPerTToEurPerTRough(168) },
		],
		genNotes: {
			bg: 'Царевицата отговаря силно на напояване; 2023–2024 — изкупни САПИ (МЗХ бюл. №46/2024); 2025 — ориентир към CBOT царевица (спад на годишна база, край на годината около ~170 USD/t) от ДКСБТ годишен бюлетин за 2025 г.; добивът е демо.',
			en: 'Strong irrigation response; 2023–2024 SAP purchases (MA bulletin 46/2024); 2025 follows CBOT maize (YoY decline; ~170 USD/t late year) per DKSBТ annual bulletin for 2025; volumes are demo.',
		},
		irrigationGeneral: {
			bg: 'Критични фази: къмцване, метличина, наливане на зърно — типично напояване по полета в Горна Тракия и край речни корита.',
			en: 'Critical stages: knee-high, tasselling, grain fill — irrigation clusters often in Upper Thrace and river corridors.',
		},
		irrigationIfDry: {
			bg: 'При продължителна суша: приоритет на напоителни масиви в Пловдивско, Пазарджишко, Свиленград–Харманли и край Марица.',
			en: 'Prolonged drought: prioritise irrigated blocks around Plovdiv, Pazardzhik, Svilengrad–Harmanli and Maritsa valley.',
		},
	},
	{
		key: 'tomatoes',
		chartColor: '#ef4444',
		label: {
			bg: 'Домати (пресни) — едро: консолидиран ред „ДОМАТИ“ (не само оранжерия)',
			en: 'Tomatoes (fresh) — wholesale: consolidated “TOMATOES” row (not greenhouse-only)',
		},
		series: [
			{ year: 2021, kt: 168 },
			{ year: 2022, kt: 182 },
			{ year: 2023, kt: 155 },
			{ year: 2024, kt: 191 },
			{ year: 2025, kt: 172 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.65) },
			{ year: 2022, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.72) },
			{ year: 2023, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.78) },
			{ year: 2024, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.83) },
			{ year: 2025, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.9) },
		],
		genNotes: {
			bg: 'Редът е консолидиран „ДОМАТИ“ в ДКСБТ — не само оранжерия; средногодишни едроцени 2,83 лв./kg (2024) и 2,90 лв./kg (2025) от годишния бюлетин за движението на цените през 2025 г. (София, януари 2026). Производството е концентрирано на юг; 2021–2023 са гладък ориентир към същата скала.',
			en: 'The bulletin row is consolidated “TOMATOES” — not greenhouse-only; annual wholesale averages 2.83 BGN/kg (2024) and 2.90 (2025) from DKSBТ’s Jan 2026 annual bulletin for 2025. Production clusters in the south; 2021–2023 are smoothed to that scale.',
		},
		irrigationGeneral: {
			bg: 'Капково и фертигация са стандарт при интензивно производство; избягване на мокрене на листата при горещини.',
			en: 'Drip + fertigation is standard for intensive outdoor/tomato fields; avoid leaf wetting in heat.',
		},
		irrigationIfDry: {
			bg: 'Суша: най-уязвими са ранните полета в Хасковско, Свиленград, Пазарджик и край Струма–Петрич (дефицит на валежи + високи температури).',
			en: 'Drought: monitor early fields in Haskovo, Svilengrad, Pazardzhik and Struma–Petrich belts first.',
		},
	},
	{
		key: 'grapes',
		chartColor: '#a855f7',
		label: {
			bg: 'Грозде (вино и маса)',
			en: 'Grapes (wine & table)',
		},
		series: [
			{ year: 2021, kt: 1180 },
			{ year: 2022, kt: 1245 },
			{ year: 2023, kt: 1095 },
			{ year: 2024, kt: 1270 },
			{ year: 2025, kt: 1140 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.06) },
			{ year: 2022, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.38) },
			{ year: 2023, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.26) },
			{ year: 2024, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.28) },
			{ year: 2025, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.24) },
		],
		genNotes: {
			bg: 'Гроздето варира силно по сезон; нивата са ориентир към сезонни едроцени (юли–окт.) в ДКСБТ годишните бюлетини; редът за 2025 не е отделена средногодишна стойност в консолидираната зеленчукова таблица — серията остава илюстративна; добивът е демо.',
			en: 'Grapes vary by season; levels follow DKSBТ Jul–Oct wholesale charts in annual bulletins; 2025 has no dedicated row in the consolidated veg table — series stays illustrative; harvest tonnes are demo.',
		},
		irrigationGeneral: {
			bg: 'Напояването е регламентирано за лозя в различни региони; контрол на вегетацията преди беритба.',
			en: 'Irrigation rules differ by PDO/PGI areas; manage canopy and water stress before harvest.',
		},
		irrigationIfDry: {
			bg: 'При суша: долините на Розова долина, Мелник, Пловдивско и Черноморието често изискват подпомагане при малки гроздове.',
			en: 'Dry years: Rose Valley, Melnik, Plovdiv subregions and parts of the coast may need deficit irrigation strategies.',
		},
	},
	{
		key: 'apples',
		chartColor: '#22c55e',
		label: {
			bg: 'Ябълки',
			en: 'Apples',
		},
		series: [
			{ year: 2021, kt: 62 },
			{ year: 2022, kt: 68 },
			{ year: 2023, kt: 59 },
			{ year: 2024, kt: 71 },
			{ year: 2025, kt: 64 },
		],
		priceSeries: [
			{ year: 2021, eurPerTonne: wholesaleBgnPerKgToEurPerT(1.55) },
			{ year: 2022, eurPerTonne: wholesaleBgnPerKgToEurPerT(1.72) },
			{ year: 2023, eurPerTonne: wholesaleBgnPerKgToEurPerT(1.62) },
			{ year: 2024, eurPerTonne: wholesaleBgnPerKgToEurPerT(1.64) },
			{ year: 2025, eurPerTonne: wholesaleBgnPerKgToEurPerT(2.1) },
		],
		genNotes: {
			bg: 'Овощарството е локализирано; средногодишни едроцени ябълки 1,64 лв./kg (2024) и 2,10 лв./kg (2025, +28% г/г) от таблица „ЯБЪЛКИ“ в ДКСБТ годишен бюлетин за 2025 г. (януари 2026); по-ранните години — ориентир.',
			en: 'Localised orchards; annual wholesale apples 1.64 BGN/kg (2024) and 2.10 (2025, +28% YoY) per DKSBТ table in the Jan 2026 annual bulletin for 2025; earlier years are illustrative.',
		},
		irrigationGeneral: {
			bg: 'Капково на контура; критични периоди цъфтеж и уголемяване на плода.',
			en: 'Drip along contour; critical periods flowering and fruit sizing.',
		},
		irrigationIfDry: {
			bg: 'Суша: по-нагорни райони в Родопите и Западна България без достъп до язовирна вода са по-уязвими.',
			en: 'Drought: upland Rhodopes and western pockets without reservoir access are more vulnerable.',
		},
	},
];
