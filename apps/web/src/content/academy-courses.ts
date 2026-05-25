/**
 * Курсове и лекции за AgriNexus Academy (Next).
 * Лекциите са Markdown в `public/lectures/<file>`.
 */
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
		description: "GPS, карти на полето, запис на операции — основа за по-малко гадаене.",
		modules: 2,
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
		],
	},
];

/** Плосък списък за компонента „Лектор“ (dropdown). */
export type LectureMeta = LectureRef & {
	courseSlug: string;
	courseTitle: string;
};

export const ALL_LECTURES: LectureMeta[] = COURSES.flatMap((c) =>
	c.lectures.map((l) => ({
		...l,
		courseSlug: c.slug,
		courseTitle: c.title,
	})),
);

export function courseBySlug(slug: string): Course | undefined {
	return COURSES.find((c) => c.slug === slug);
}

export function lectureById(id: string): LectureMeta | undefined {
	return ALL_LECTURES.find((l) => l.id === id);
}
