import type { UiLang } from './i18n';

export type Localized = { bg: string; en: string; ar: string };

export type CropKey =
	| 'wheat_barley'
	| 'sunflower'
	| 'maize'
	| 'tomatoes'
	| 'grapes'
	| 'apples';

export function pickL(t: Localized, lang: UiLang): string {
	if (lang === 'bg') return t.bg;
	if (lang === 'ar') return t.ar;
	return t.en;
}

/** Production in thousand tonnes (хил. т) — илюстративни стойности за демо графика. */
export type YearPoint = { year: number; kt: number };

export type CropProfile = {
	key: CropKey;
	chartColor: string;
	label: Localized;
	/** Производство (хил. т) за последните 5 завършени кампании */
	series: YearPoint[];
	genNotes: Localized;
	irrigationGeneral: Localized;
	irrigationIfDry: Localized;
};

/** Линейна регресия y = a + b·year → прогноза за следващата година */
export function forecastProductionKt(series: YearPoint[]): {
	nextYear: number;
	forecastKt: number;
	slopeKtPerYear: number;
	intercept: number;
} {
	const ys = series.map(p => p.year);
	const vs = series.map(p => p.kt);
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
	const forecastKt = Math.max(0, a + b * nextYear);
	return { nextYear, forecastKt, slopeKtPerYear: b, intercept: a };
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
		ar: 'انحدار سالب في الاتجاه التجريبي (تراجع حجم إذا استُقرئ)',
	},
	trend_up: {
		bg: 'положителен наклон на тенденцията в примерните данни',
		en: 'positive slope in the demo trend',
		ar: 'ميل إيجابي في الاتجاه التجريبي',
	},
	dry_heuristic: {
		bg: 'сигнал за суша по евристика (рязък спад последна спрямо предходна година или стръмен отрицателен наклон)',
		en: 'dry-pattern heuristic (sharp drop vs prior year or steep negative slope)',
		ar: 'مؤشر جفاف تجريبي (هبوط حاد مقارنة بالسنة السابقة أو ميل سلبي حاد)',
	},
	forecast_below_avg: {
		bg: 'прогнозният обем е под средното на петте години в серията',
		en: 'forecast volume sits below the five-year demo average',
		ar: 'حجم التوقع أدنى من متوسط السنوات الخمس التجريبية',
	},
	forecast_above_avg: {
		bg: 'прогнозният обем е над средното на петте години в серията',
		en: 'forecast volume sits above the five-year demo average',
		ar: 'حجم التوقع أعلى من متوسط السنوات الخمس التجريبية',
	},
	high_volatility: {
		bg: 'големи колебания между годините (непостоянен добив в примерните данни)',
		en: 'large year-to-year swings (uneven harvest in the demo series)',
		ar: 'تقلبات كبيرة بين السنوات (محصول غير مستقر في السلسلة التجريبية)',
	},
};

export const OUTLOOK_FACTORS_NONE: Localized = {
	bg: 'няма отделни сигнали извън малки отклонения от средното — картината е умерена.',
	en: 'no standout signals beyond small deviations from average — a moderate picture.',
	ar: 'لا مؤشرات بارزة غير انحرافات بسيطة عن المتوسط — صورة متوسطة.',
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

export const CROP_PROFILES: CropProfile[] = [
	{
		key: 'wheat_barley',
		chartColor: '#c9a227',
		label: {
			bg: 'Пшеница и ечемик (общо)',
			en: 'Wheat & barley (combined)',
			ar: 'قمح وشعير (مجمع)',
		},
		series: [
			{ year: 2021, kt: 5980 },
			{ year: 2022, kt: 6310 },
			{ year: 2023, kt: 6145 },
			{ year: 2024, kt: 6420 },
			{ year: 2025, kt: 6280 },
		],
		genNotes: {
			bg: 'Зърното доминира в Добруджа и горнотракийската низина; прогнозата следва тенденцията от таблицата (демо).',
			en: 'Grain is concentrated in Dobruja and the Upper Thracian Plain; the forecast extrapolates the demo trend.',
			ar: 'تركز إنتاج الحبوب في دوبروجا وسهل ثراسيا العلوي؛ التوقعات تعتمد على اتجاه البيانات التجريبية.',
		},
		irrigationGeneral: {
			bg: 'При зърнено обикновено се разчита на валежи; напояването е ограничено, но напръскване при горещ етап на пшеницата и подпомагане при „фиданкови“ посеви на царевица/слънчоглед по поречия.',
			en: 'Rainfed dominates for cereals; irrigation is limited — consider supplemental water for critical stages or downstream crops in valleys.',
			ar: 'يعتمد القمح عادة على المطر؛ الري محدود مع إمكانية ري تكميلي في مراحل حساسة.',
		},
		irrigationIfDry: {
			bg: 'При суша: приоритет на напояване в Добруджа и Източна България (по-ниски валежи през пролетта), както и по Черноморското крайбрежие при дефицит на влага при закласяване.',
			en: 'In dry spells: prioritise irrigated blocks in Dobruja & eastern Bulgaria, plus coastal strips if moisture fails during grain fill.',
			ar: 'في الجفاف: أولوية لمناطق دوبروجا وشرق بلغاريا والساحل عند نقص الرطوبة.',
		},
	},
	{
		key: 'sunflower',
		chartColor: '#f4b400',
		label: {
			bg: 'Слънчоглед',
			en: 'Sunflower',
			ar: 'عباد الشمس',
		},
		series: [
			{ year: 2021, kt: 1680 },
			{ year: 2022, kt: 1820 },
			{ year: 2023, kt: 1755 },
			{ year: 2024, kt: 1890 },
			{ year: 2025, kt: 1780 },
		],
		genNotes: {
			bg: 'Слънчогледът е чувствителен на влага при цъфтеж и пълнене на семена — тенденцията в графиката е образец.',
			en: 'Sunflower is moisture-sensitive at flowering and seed fill — chart shows illustrative volumes.',
			ar: 'عباد الشمس حساس للرطوبة عند الإزهار وامتلاء البذور؛ البيانات للتوضيح.',
		},
		irrigationGeneral: {
			bg: 'При напояване: равномерна влага по време на цъфтеж; избягване на преполиване преди жътва.',
			en: 'If irrigating: keep even moisture through flowering; avoid waterlogging before harvest.',
			ar: 'عند الري: رطوبة متساوية أثناء الإزهار وتجنب الإفراط قبل الحصاد.',
		},
		irrigationIfDry: {
			bg: 'Сухо: силно засегнати са лесните почви в Северна България и участъци без задържане на влага — подпомагане на инвазионни полета по Янтра, Осъм, Дунавска равнина.',
			en: 'Dry years: lighter soils in northern Bulgaria suffer first — prioritise fields along Yantra, Osam and Danube plain corridors.',
			ar: 'في الجفاف: التربة الخفيفة في الشمال أولاً — ممرات يانترا وأوسام وسهل الدانوب.',
		},
	},
	{
		key: 'maize',
		chartColor: '#e8c547',
		label: {
			bg: 'Царевица',
			en: 'Maize',
			ar: 'ذرة',
		},
		series: [
			{ year: 2021, kt: 2100 },
			{ year: 2022, kt: 2380 },
			{ year: 2023, kt: 2240 },
			{ year: 2024, kt: 2510 },
			{ year: 2025, kt: 2395 },
		],
		genNotes: {
			bg: 'Царевицата отговаря силно на напояване; числата са демо за визуализация на тенденция.',
			en: 'Maize responds strongly to irrigation; numbers are demo-only for trend visualisation.',
			ar: 'الذرة تستجيب بقوة للري؛ الأرقام للعرض فقط.',
		},
		irrigationGeneral: {
			bg: 'Критични фази: къмцване, метличина, наливане на зърно — типично напояване по полета в Горна Тракия и край речни корита.',
			en: 'Critical stages: knee-high, tasselling, grain fill — irrigation clusters often in Upper Thrace and river corridors.',
			ar: 'المراحل الحرجة: الارتفاع، الإزهار، امتلاء الحبة — الري شائع في ثراسيا العليا والأنهار.',
		},
		irrigationIfDry: {
			bg: 'При продължителна суша: приоритет на напоителни масиви в Пловдивско, Пазарджишко, Свиленград–Харманли и край Марица.',
			en: 'Prolonged drought: prioritise irrigated blocks around Plovdiv, Pazardzhik, Svilengrad–Harmanli and Maritsa valley.',
			ar: 'جفاف طويل: أولوية لمناطق بلوفديف وبازارجيك ووادي ماريتسا.',
		},
	},
	{
		key: 'tomatoes',
		chartColor: '#ef4444',
		label: {
			bg: 'Домати (пресни)',
			en: 'Tomatoes (fresh)',
			ar: 'طماطم (طازجة)',
		},
		series: [
			{ year: 2021, kt: 168 },
			{ year: 2022, kt: 182 },
			{ year: 2023, kt: 155 },
			{ year: 2024, kt: 191 },
			{ year: 2025, kt: 172 },
		],
		genNotes: {
			bg: 'Доматите са концентрирани в Южна България и край големи преработватели; колебанията имитират метеорологични години.',
			en: 'Tomatoes cluster in southern Bulgaria and near processors; swings mimic weather-driven seasons.',
			ar: 'الطماطم مركزة في الجنوب وقرب المصانع؛ التقلبات تحاكي الأحوال الجوية.',
		},
		irrigationGeneral: {
			bg: 'Капково и фертигация са стандарт при интензивно производство; избягване на мокрене на листата при горещини.',
			en: 'Drip + fertigation is standard for intensive outdoor/tomato fields; avoid leaf wetting in heat.',
			ar: 'الري بالتنقيط والتسميد المائي شائع؛ تجنب ترطيب الأوراق في الحر.',
		},
		irrigationIfDry: {
			bg: 'Суша: най-уязвими са ранните полета в Хасковско, Свиленград, Пазарджик и край Струма–Петрич (дефицит на валежи + високи температури).',
			en: 'Drought: monitor early fields in Haskovo, Svilengrad, Pazardzhik and Struma–Petrich belts first.',
			ar: 'الجفاف: راقب حقول هاسكوفو وسفيلينغراد وبازارجيك وستروما–بيتريتش.',
		},
	},
	{
		key: 'grapes',
		chartColor: '#a855f7',
		label: {
			bg: 'Грозде (вино и маса)',
			en: 'Grapes (wine & table)',
			ar: 'عنب (خمر ومائدة)',
		},
		series: [
			{ year: 2021, kt: 1180 },
			{ year: 2022, kt: 1245 },
			{ year: 2023, kt: 1095 },
			{ year: 2024, kt: 1270 },
			{ year: 2025, kt: 1140 },
		],
		genNotes: {
			bg: 'Гроздето варира с пролетни слани и летни горещини; прогнозата е математическа екстраполация на демо данни.',
			en: 'Grape harvest varies with spring frost and summer heat — forecast is pure extrapolation on demo data.',
			ar: 'محصول العنب يتأثر بالصقيع والحر؛ التوقع استقراء على بيانات تجريبية.',
		},
		irrigationGeneral: {
			bg: 'Напояването е регламентирано за лозя в различни региони; контрол на вегетацията преди беритба.',
			en: 'Irrigation rules differ by PDO/PGI areas; manage canopy and water stress before harvest.',
			ar: 'قواعد الري تختلف حسب المناطق؛ إدارة الماء قبل الحصاد.',
		},
		irrigationIfDry: {
			bg: 'При суша: долините на Розова долина, Мелник, Пловдивско и Черноморието често изискват подпомагане при малки гроздове.',
			en: 'Dry years: Rose Valley, Melnik, Plovdiv subregions and parts of the coast may need deficit irrigation strategies.',
			ar: 'في الجفاف: وادي الورد وملنيك وبلوفديف والساحل قد تحتاج استراتيجيات ري محسوبة.',
		},
	},
	{
		key: 'apples',
		chartColor: '#22c55e',
		label: {
			bg: 'Ябълки',
			en: 'Apples',
			ar: 'تفاح',
		},
		series: [
			{ year: 2021, kt: 62 },
			{ year: 2022, kt: 68 },
			{ year: 2023, kt: 59 },
			{ year: 2024, kt: 71 },
			{ year: 2025, kt: 64 },
		],
		genNotes: {
			bg: 'Овощарството е локализирано (Старозагорско, Пловдивско, Родопи); малки обеми спрямо зърното.',
			en: 'Orchards are localised (Stara Zagora, Plovdiv, Rhodopes) — small volumes vs grains.',
			ar: 'البساتين موزعة محلياً؛ أحجام أصغر مقارنة بالحبوب.',
		},
		irrigationGeneral: {
			bg: 'Капково на контура; критични периоди цъфтеж и уголемяване на плода.',
			en: 'Drip along contour; critical periods flowering and fruit sizing.',
			ar: 'ري بالتنقيط؛ مراحل الإزهار وتكبير الثمرة حرجة.',
		},
		irrigationIfDry: {
			bg: 'Суша: по-нагорни райони в Родопите и Западна България без достъп до язовирна вода са по-уязвими.',
			en: 'Drought: upland Rhodopes and western pockets without reservoir access are more vulnerable.',
			ar: 'الجفاف: المرتفعات في رودوب وغرب بلغاريا الأكثر هشاشة.',
		},
	},
];
