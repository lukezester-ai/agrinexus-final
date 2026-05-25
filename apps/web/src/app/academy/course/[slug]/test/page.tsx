import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, courseBySlug } from "@/content/academy-courses";
import { getFinalTest } from "@/content/final-course-tests";
import { CourseFinalTestQuiz } from "@/components/course-final-test";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
	return COURSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props) {
	const { slug } = await params;
	const course = courseBySlug(slug);
	if (!course) return { title: "Тест · AgriNexus" };
	return { title: `Финален тест · ${course.title} · AgriNexus` };
}

export default async function CourseTestPage({ params }: Props) {
	const { slug } = await params;
	const course = courseBySlug(slug);
	const test = getFinalTest(slug);
	if (!course || !test) notFound();

	return (
		<main className="mx-auto max-w-3xl px-6 py-12">
			<CourseFinalTestQuiz courseTitle={course.title} test={test} />

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href={`/academy/course/${slug}`} className="text-emerald-800 underline underline-offset-4">
					← Към курса
				</Link>
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					Всички курсове
				</Link>
			</p>
		</main>
	);
}
