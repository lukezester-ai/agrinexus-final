/**
 * Курсове и лекции за AgriNexus Academy (Next).
 * Лекциите са Markdown в `public/lectures/<file>`.
 */
import type { AppLocale } from "@/i18n/routing";
import { courseEn } from "./academy-en";
export type LectureRef = {
	id: string;
	title: string;
	summary: string;
	/** път под public/lectures/, напр. courses/soil-fertility/01-probi.md */
	file: string;
};

export type Course = {
	slug: string;
	title: string;
	description: string;
	modules: number;
	lectures: LectureRef[];
};

export const COURSES: Course[] = [
	{
		slug: "soil-fertility",
		title: "Почвено плодородие и торене",
		description: "Проби, pH, органика и разумни ставки NPK за устойчив добив.",
		modules: 2,
		lectures: [
			{
				id: "sf-probi",
				title: "Проби и базова диагностика",
				summary: "Какво да поръчате в лабораторията и как да четете резултата с бизнес очи.",
				file: "courses/soil-fertility/01-probi-i-baza.md",
			},
			{
				id: "sf-npk",
				title: "NPK баланс без изгаряне на бюджета",
				summary: "Кога повече тор не значи повече пари в джоба.",
				file: "courses/soil-fertility/02-npk-balans.md",
			},
		],
	},
	{
		slug: "crop-markets",
		title: "Пазар на култури за стопанството",
		description: "Борса, базис, логистика — от котировка до цена при полето.",
		modules: 2,
		lectures: [
			{
				id: "cm-basis",
				title: "Базис и локална цена",
				summary: "Защо при еднаква борса двама съседи получават различна цена.",
				file: "courses/crop-markets/01-bazis-lokalna-cena.md",
			},
			{
				id: "cm-timing",
				title: "Време на продажба и склад",
				summary: "Сезонност, влага, отстъпки — как „чакането“ струва пари.",
				file: "courses/crop-markets/02-vreme-prodazba-sklad.md",
			},
		],
	},
	{
		slug: "water-irrigation",
		title: "Вода и иригация",
		description: "Воден бюджет, риск от суша и разговор с банкера на език m³/ha.",
		modules: 2,
		lectures: [
			{
				id: "wi-budget",
				title: "Воден бюджет на сезона",
				summary: "Отделна линия в разходите — не „остатък“ след торовете.",
				file: "courses/water-irrigation/01-voden-byudzhet.md",
			},
			{
				id: "wi-energy",
				title: "Помпи и енергия",
				summary: "Когато токът изяде спестенията от по-малко тор.",
				file: "courses/water-irrigation/02-pompi-energiya.md",
			},
		],
	},
	{
		slug: "farm-finance",
		title: "Финанси и риск в стопанството",
		description: "Оборот, застраховки, субсидии и прости показатели за решения.",
		modules: 2,
		lectures: [
			{
				id: "ff-working-capital",
				title: "Оборотен капитал в кампанията",
				summary: "Защо сушата е и кредитен риск.",
				file: "courses/farm-finance/01-oboroten-kapital.md",
			},
			{
				id: "ff-insurance",
				title: "Застраховки и метео прагове",
				summary: "Какво „доказуемо“ иска финансовият партньор.",
				file: "courses/farm-finance/02-zastrahovki-meteo.md",
			},
		],
	},
	{
		slug: "precision-data",
		title: "Прецизно земеделие и данни",
		description: "Карти и слоеве, GPS, метео за операции, карти на добив, запис — по-малко гадаене.",
		modules: 5,
		lectures: [
			{
				id: "pd-yield-maps",
				title: "Карти на добива и зониране",
				summary: "От снимка към решение: къде да вложите следващия лев.",
				file: "courses/precision-data/01-karti-dobiv-zonirane.md",
			},
			{
				id: "pd-traceability",
				title: "Проследимост и запис",
				summary: "Защо „дневникът“ на полето плаща при изкупуване и при спор.",
				file: "courses/precision-data/02-prosledimost-zapis.md",
			},
			{
				id: "pd-maps-gps",
				title: "Карти, GPS и слоеве в полето",
				summary: "Ортофото, слоеве, телефон срещу приемник, граници и AB линии без объркване.",
				file: "courses/precision-data/03-karti-gps-sloevi.md",
			},
			{
				id: "pd-weather-ops",
				title: "Метео за операции",
				summary: "Кратък и сезонен хоризонт, локална станция, вятър за пръскане, радар за дъжд.",
				file: "courses/precision-data/04-meteo-operatsii.md",
			},
			{
				id: "pd-field-sat-maps-practice",
				title: "Практически занятия: карта, полета и сателит в реално време",
				summary: "Очертаване на блокове, сателитни слоеве във времето, проверка на граници с GPS и обновяване в полето.",
				file: "courses/precision-data/05-praktika-karta-satelit-poleta.md",
			},
		],
	},
	{
		slug: "maps-and-fields",
		title: "Карти и полета",
		description:
			"Отделен курс с жива учебна карта в браузъра: улици (OpenStreetMap), сателитен слой, очертаване на блок с кликове и изтегляне на GeoJSON.",
		modules: 3,
		lectures: [
			{
				id: "mf-why-draw",
				title: "Защо чертаем блокове и какво е полигон",
				summary: "Ролята на картата между стопанството, агронома и машината; понятия преди лабораторията.",
				file: "courses/maps-and-fields/01-vavedenie-karti-poleta.md",
			},
			{
				id: "mf-live-map",
				title: "Жива карта: лаборатория в AgriNexus",
				summary: "Страницата /academy/maps — реални плочки, сателит, клик за върхове и GeoJSON за упражнения.",
				file: "courses/maps-and-fields/02-zhiva-karta-lab.md",
			},
			{
				id: "mf-export-workflow",
				title: "От чертежа до техниката и партньорите",
				summary: "Подаване на файл към FMIS/QGIS и проверки преди операция в полето.",
				file: "courses/maps-and-fields/03-eksport-i-raboten-potok.md",
			},
		],
	},
	{
		slug: "drone-pilots",
		title: "Пилоти на дронове в стопанството",
		description: "Симулатор: DJI където е уместно, безплатни варианти (напр. FPV SkyDive), тренинг на ръцете и безопасен преход към полет над нивата.",
		modules: 2,
		lectures: [
			{
				id: "dp-sim",
				title: "Симулатор и тренинг преди първия полет",
				summary: "DJI симулатори, безплатни варианти (напр. FPV SkyDive) и кратки сесии — по-малко скъпи грешки с витла и ориентация.",
				file: "courses/drone-pilots/01-simulator-trening.md",
			},
			{
				id: "dp-field",
				title: "От симулатора до полето: безопасност и регламент",
				summary: "Чеклист, екип от двама, поверителност — без да заместваме официалния регулатор.",
				file: "courses/drone-pilots/02-bezopasnost-i-reglament.md",
			},
		],
	},
];

/** Плосък списък за компонента „Лектор“ (dropdown). */
export type LectureMeta = LectureRef & {
	courseSlug: string;
	courseTitle: string;
};

function localizeCourse(course: Course, locale: AppLocale): Course {
	if (locale === "bg") return course;
	const en = courseEn[course.slug];
	if (!en) return course;
	return {
		...course,
		title: en.title,
		description: en.description,
		lectures: course.lectures.map((l) => {
			const lt = en.lectures[l.id];
			return lt ? { ...l, title: lt.title, summary: lt.summary } : l;
		}),
	};
}

export function coursesForLocale(locale: AppLocale): Course[] {
	return COURSES.map((c) => localizeCourse(c, locale));
}

export function courseBySlug(slug: string, locale: AppLocale = "bg"): Course | undefined {
	const c = COURSES.find((x) => x.slug === slug);
	return c ? localizeCourse(c, locale) : undefined;
}

export function allLecturesForLocale(locale: AppLocale): LectureMeta[] {
	return coursesForLocale(locale).flatMap((c) =>
		c.lectures.map((l) => ({
			...l,
			courseSlug: c.slug,
			courseTitle: c.title,
		})),
	);
}

/** @deprecated Prefer `allLecturesForLocale("bg")` — kept for older imports. */
export const ALL_LECTURES: LectureMeta[] = allLecturesForLocale("bg");

export function lectureMetaById(id: string, locale: AppLocale = "bg"): LectureMeta | undefined {
	return allLecturesForLocale(locale).find((l) => l.id === id);
}

export function lectureById(id: string): LectureMeta | undefined {
	return lectureMetaById(id, "bg");
}
