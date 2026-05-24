import Link from "next/link";
import { notFound } from "next/navigation";

const TITLES: Record<string, string> = {
	"market-literacy": "Market literacy starter",
	"sense-think-act": "Sense → Think → Act overview",
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
	const { slug } = await params;
	const title = TITLES[slug];
	if (!title) return { title: "Course · AgriNexus" };
	return { title: `${title} · AgriNexus` };
}

export default async function CoursePage({ params }: Props) {
	const { slug } = await params;
	const title = TITLES[slug];
	if (!title) notFound();

	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · Course</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
			<p className="mt-3 text-slate-600">
				Skeleton: modules, video embeds, and quizzes will load from the backend. Slug:{" "}
				<code className="rounded bg-slate-200 px-1">{slug}</code>
			</p>
			<ol className="mt-8 list-decimal space-y-2 pl-6 text-slate-800">
				<li>Module 1 — placeholder</li>
				<li>Module 2 — placeholder</li>
				<li>Module 3 — placeholder</li>
			</ol>
			<p className="mt-10 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					← All courses
				</Link>
			</p>
		</main>
	);
}
