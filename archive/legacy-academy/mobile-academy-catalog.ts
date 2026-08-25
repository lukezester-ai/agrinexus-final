import { coursesForLocale } from "@/content/academy-courses";
import type { AppLocale } from "@/i18n/routing";

/** JSON shape consumed by `apps/mobile` (both locales per field). */
export type MobileLectureJson = {
	id: string;
	title: { en: string; bg: string };
	summary: { en: string; bg: string };
};

export type MobileCourseJson = {
	slug: string;
	modules: number;
	title: { en: string; bg: string };
	description: { en: string; bg: string };
	lectures: MobileLectureJson[];
};

export function getMobileAcademyCatalog(): MobileCourseJson[] {
	const en = coursesForLocale("en");
	const bg = coursesForLocale("bg");
	return en.map((cEn) => {
		const cBg = bg.find((b) => b.slug === cEn.slug);
		if (!cBg) {
			throw new Error(`Missing BG course for slug: ${cEn.slug}`);
		}
		const lectures: MobileLectureJson[] = cEn.lectures.map((lEn) => {
			const lBg = cBg.lectures.find((l) => l.id === lEn.id);
			if (!lBg) {
				throw new Error(`Missing BG lecture ${lEn.id} in ${cEn.slug}`);
			}
			return {
				id: lEn.id,
				title: { en: lEn.title, bg: lBg.title },
				summary: { en: lEn.summary, bg: lBg.summary },
			};
		});
		return {
			slug: cEn.slug,
			modules: cEn.modules,
			title: { en: cEn.title, bg: cBg.title },
			description: { en: cEn.description, bg: cBg.description },
			lectures,
		};
	});
}
