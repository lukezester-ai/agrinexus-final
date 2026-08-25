import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { COURSES, courseBySlug } from "@/content/academy-courses";
import { getFinalTest } from "@/content/final-course-tests";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
	return routing.locales.flatMap((locale) => COURSES.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: Props) {
	const { locale, slug } = await params;
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "Course" });
	const course = courseBySlug(slug, locale as AppLocale);
	if (!course) return { title: t("metaFallback") };
	return { title: `${course.title} · AgriNexus` };
}

export default async function CoursePage({ params }: Props) {
	const { locale, slug } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("Course");
	const course = courseBySlug(slug, locale as AppLocale);
	if (!course) notFound();
	const hasFinalTest = getFinalTest(slug) !== undefined;

	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{t("kicker")}</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{course.title}</h1>
			<p className="mt-3 text-slate-600">{course.description}</p>
			<p className="mt-2 text-sm text-slate-500">
				{t("modulesHint", { count: course.modules, slug })}
			</p>

			<ol className="mt-8 list-decimal space-y-3 pl-6 text-slate-800">
				{course.lectures.map((lec, i) => (
					<li key={lec.id} className="pl-1">
						<p className="font-medium text-slate-900">
							{i + 1}. {lec.title}
						</p>
						<p className="mt-1 text-sm text-slate-600">{lec.summary}</p>
						<Link
							href={`/academy/lecturer?focus=${encodeURIComponent(lec.id)}`}
							className="mt-2 inline-block text-sm font-medium text-emerald-800 underline underline-offset-4"
						>
							{t("openLecturer")}
						</Link>
					</li>
				))}
			</ol>

			{hasFinalTest ? (
				<Link
					href={`/academy/course/${slug}/test`}
					className="mt-8 flex items-center justify-between gap-4 rounded-2xl border-2 border-amber-500/80 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm transition-colors hover:bg-amber-100/90"
				>
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t("finalTestEyebrow")}</p>
						<p className="font-semibold">{t("finalTestTitle")}</p>
						<p className="mt-1 text-sm text-amber-900/90">{t("finalTestSub")}</p>
					</div>
					<span className="text-2xl" aria-hidden>
						→
					</span>
				</Link>
			) : null}

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					{t("backCourses")}
				</Link>
				<Link href="/academy/lecturer" className="text-emerald-800 underline underline-offset-4">
					{t("lecturerPicker")}
				</Link>
			</p>
		</main>
	);
}
