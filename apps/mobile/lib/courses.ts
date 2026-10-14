/** Mirrors apps/web academy catalog (EN/BG) for mobile offline list + detail. */

export type Localized = { en: string; bg: string };

export type LectureRow = {
	id: string;
	title: Localized;
	summary: Localized;
};

export type CourseRow = {
	slug: string;
	modules: number;
	title: Localized;
	description: Localized;
	lectures: LectureRow[];
};

export const COURSES: CourseRow[] = [
	{
		slug: "soil-fertility",
		modules: 2,
		title: {
			bg: "Почвено плодородие и торене",
			en: "Soil fertility and fertilization",
		},
		description: {
			bg: "Проби, pH, органика и разумни ставки NPK за устойчив добив.",
			en: "Soil tests, pH, organic matter, and sensible NPK rates for resilient yield.",
		},
		lectures: [
			{
				id: "sf-probi",
				title: {
					bg: "Проби и базова диагностика",
					en: "Soil tests and basic diagnostics",
				},
				summary: {
					bg: "Какво да поръчате в лабораторията и как да четете резултата с бизнес очи.",
					en: "What to order from the lab and how to read results with a business mindset.",
				},
			},
			{
				id: "sf-npk",
				title: {
					bg: "NPK баланс без изгаряне на бюджета",
					en: "NPK balance without burning budget",
				},
				summary: {
					bg: "Кога повече тор не значи повече пари в джоба.",
					en: "When more fertilizer does not mean more profit.",
				},
			},
		],
	},
	{
		slug: "crop-markets",
		modules: 2,
		title: {
			bg: "Пазар на култури за стопанството",
			en: "Crop markets for the farm",
		},
		description: {
			bg: "Борса, базис, логистика — от котировка до цена при полето.",
			en: "Exchange, basis, logistics — from futures quotes to price at the field gate.",
		},
		lectures: [
			{
				id: "cm-basis",
				title: { bg: "Базис и локална цена", en: "Basis and local price" },
				summary: {
					bg: "Защо при еднаква борса двама съседи получават различна цена.",
					en: "Why two neighbours can get different prices with the same exchange print.",
				},
			},
			{
				id: "cm-timing",
				title: { bg: "Време на продажба и склад", en: "Selling timing and storage" },
				summary: {
					bg: "Сезонност, влага, отстъпки — как „чакането“ струва пари.",
					en: "Seasonality, moisture, discounts — how “waiting” costs money.",
				},
			},
		],
	},
	{
		slug: "water-irrigation",
		modules: 2,
		title: { bg: "Вода и иригация", en: "Water and irrigation" },
		description: {
			bg: "Воден бюджет, риск от суша и разговор с банкера на език m³/ha.",
			en: "Water budget, drought risk, and talking to your banker in m³/ha language.",
		},
		lectures: [
			{
				id: "wi-budget",
				title: { bg: "Воден бюджет на сезона", en: "Season water budget" },
				summary: {
					bg: "Отделна линия в разходите — не „остатък“ след торовете.",
					en: "A dedicated cost line — not a leftover after fertilizer.",
				},
			},
			{
				id: "wi-energy",
				title: { bg: "Помпи и енергия", en: "Pumps and energy" },
				summary: {
					bg: "Когато токът изяде спестенията от по-малко тор.",
					en: "When electricity eats the savings from “less fertilizer”.",
				},
			},
		],
	},
	{
		slug: "farm-finance",
		modules: 2,
		title: { bg: "Финанси и риск в стопанството", en: "Farm finance and risk" },
		description: {
			bg: "Оборот, застраховки, субсидии и прости показатели за решения.",
			en: "Working capital, insurance, subsidies, and simple metrics for decisions.",
		},
		lectures: [
			{
				id: "ff-working-capital",
				title: { bg: "Оборотен капитал в кампанията", en: "Working capital in the campaign" },
				summary: {
					bg: "Защо сушата е и кредитен риск.",
					en: "Why drought is also a credit risk.",
				},
			},
			{
				id: "ff-insurance",
				title: { bg: "Застраховки и метео прагове", en: "Insurance and weather triggers" },
				summary: {
					bg: "Какво „доказуемо“ иска финансовият партньор.",
					en: "What “verifiable” means to a financial partner.",
				},
			},
		],
	},
	{
		slug: "precision-data",
		modules: 5,
		title: { bg: "Прецизно земеделие и данни", en: "Precision farming and data" },
		description: {
			bg: "Карти и слоеве, GPS, метео за операции, карти на добив, запис — по-малко гадаене.",
			en: "Maps and layers, GPS, weather for operations, yield maps, records — less guesswork.",
		},
		lectures: [
			{
				id: "pd-yield-maps",
				title: { bg: "Карти на добива и зониране", en: "Yield maps and zoning" },
				summary: {
					bg: "От снимка към решение: къде да вложите следващия лев.",
					en: "From a picture to a decision: where to spend the next euro.",
				},
			},
			{
				id: "pd-traceability",
				title: { bg: "Проследимост и запис", en: "Traceability and records" },
				summary: {
					bg: "Защо „дневникът“ на полето плаща при изкупуване и при спор.",
					en: "Why a field diary pays at purchase and in disputes.",
				},
			},
			{
				id: "pd-maps-gps",
				title: {
					bg: "Карти, GPS и слоеве в полето",
					en: "Maps, GPS, and layers in the field",
				},
				summary: {
					bg: "Ортофото, слоеве, телефон срещу приемник, граници и AB линии без объркване.",
					en: "Orthophoto, layers, phone vs receiver, boundaries and AB lines without confusion.",
				},
			},
			{
				id: "pd-weather-ops",
				title: { bg: "Метео за операции", en: "Weather for field operations" },
				summary: {
					bg: "Кратък и сезонен хоризонт, локална станция, вятър за пръскане, радар за дъжд.",
					en: "Short vs seasonal outlook, local station, spray wind limits, rain radar.",
				},
			},
			{
				id: "pd-field-sat-maps-practice",
				title: {
					bg: "Практически занятия: карта, полета и сателит в реално време",
					en: "Hands-on: maps, field outlines, and satellite in (near) real time",
				},
				summary: {
					bg: "Очертаване на блокове, сателитни слоеве във времето, проверка на граници с GPS и обновяване в полето.",
					en: "Draw parcel polygons, use satellite time series, walk boundaries with live GPS, and refresh layers safely in the field.",
				},
			},
		],
	},
	{
		slug: "maps-and-fields",
		modules: 3,
		title: { bg: "Карти и полета", en: "Maps and field outlines" },
		description: {
			bg: "Отделен курс с жива учебна карта в браузъра: улици (OpenStreetMap), сателитен слой, очертаване на блок с кликове и изтегляне на GeoJSON.",
			en: "A dedicated course with a live training map in the browser: streets (OpenStreetMap), satellite layer, click-to-outline parcels, and GeoJSON download.",
		},
		lectures: [
			{
				id: "mf-why-draw",
				title: {
					bg: "Защо чертаем блокове и какво е полигон",
					en: "Why we draw blocks and what a polygon is",
				},
				summary: {
					bg: "Ролята на картата между стопанството, агронома и машината; понятия преди лабораторията.",
					en: "How maps connect farm, agronomist, and machinery — concepts before the lab.",
				},
			},
			{
				id: "mf-live-map",
				title: {
					bg: "Жива карта: лаборатория в AgriNexus",
					en: "Live map: AgriNexus lab",
				},
				summary: {
					bg: "Страницата /academy/maps — реални плочки, сателит, клик за върхове и GeoJSON за упражнения.",
					en: "The /academy/maps page — real tiles, satellite, click vertices, GeoJSON for exercises.",
				},
			},
			{
				id: "mf-export-workflow",
				title: {
					bg: "От чертежа до техниката и партньорите",
					en: "From sketch to machinery and partners",
				},
				summary: {
					bg: "Подаване на файл към FMIS/QGIS и проверки преди операция в полето.",
					en: "Handing files to FMIS/QGIS and checks before field operations.",
				},
			},
		],
	},
	{
		slug: "drone-pilots",
		modules: 2,
		title: { bg: "Пилоти на дронове в стопанството", en: "Farm drone pilots" },
		description: {
			bg: "Симулатор: DJI където е уместно, безплатни варианти (напр. FPV SkyDive), тренинг на ръцете и безопасен преход към полет над нивата.",
			en: "Simulator training (DJI tools where relevant, plus free-tier options like FPV SkyDive), stick skills, and a safe path to flights over cropland.",
		},
		lectures: [
			{
				id: "dp-sim",
				title: {
					bg: "Симулатор и тренинг преди първия полет",
					en: "Simulator training before the first flight",
				},
				summary: {
					bg: "DJI симулатори, безплатни варианти (напр. FPV SkyDive) и кратки сесии — по-малко скъпи грешки с витла и ориентация.",
					en: "DJI simulators, free-tier options (e.g. FPV SkyDive on Steam), and short sessions — fewer expensive prop and orientation mistakes.",
				},
			},
			{
				id: "dp-field",
				title: {
					bg: "От симулатора до полето: безопасност и регламент",
					en: "From simulator to field: safety and rules",
				},
				summary: {
					bg: "Чеклист, екип от двама, поверителност — без да заместваме официалния регулатор.",
					en: "Checklists, two-person crew, privacy — without replacing the official regulator.",
				},
			},
		],
	},
];

export function courseBySlug(slug: string): CourseRow | undefined {
	return COURSES.find((c) => c.slug === slug);
}
