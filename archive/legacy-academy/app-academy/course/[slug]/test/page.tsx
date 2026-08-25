import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { COURSES, courseBySlug } from "@/content/academy-courses";
import { getFinalTest } from "@/content/final-course-tests";
import { CourseFinalTestQuiz } from "@/components/course-final-test";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
	return routing.locales.flatMap((locale) => COURSES.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Props) {
	const { locale, slug } = await params;
	setRequestLocale(locale);
	const course = courseBySlug(slug, locale as AppLocale);
	if (!course) return { title: "Test · AgriNexus" };
	return { title: `Final test · ${course.title} · AgriNexus` };
}

export default async function CourseTestPage({ params }: Props) {
	const { locale, slug } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("Course");
	const course = courseBySlug(slug, locale as AppLocale);
	const test = getFinalTest(slug);
	if (!course || !test) notFound();

	return (
		<main className="mx-auto max-w-3xl px-6 py-12">
			<CourseFinalTestQuiz courseTitle={course.title} test={test} />

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href={`/academy/course/${slug}`} className="text-emerald-800 underline underline-offset-4">
					{t("backToCourse")}
				</Link>
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					{t("allCoursesShort")}
				</Link>
			</p>
		</main>
	);
}
