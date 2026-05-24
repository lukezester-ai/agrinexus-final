import Link from "next/link";

const STUB_COURSES = [
	{ slug: "market-literacy", title: "Market literacy starter", modules: 3 },
	{ slug: "sense-think-act", title: "Sense → Think → Act overview", modules: 2 },
];

export const metadata = {
	title: "Academy · AgriNexus",
	description: "Course list skeleton",
};

export default function AcademyHubPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · Academy</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Courses (skeleton)</h1>
			<p className="mt-3 text-slate-600">
				Static placeholder list. Replace with API from <code className="rounded bg-slate-200 px-1">apps/backend</code> + learner progress.
			</p>
			<ul className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
				{STUB_COURSES.map((c) => (
					<li key={c.slug}>
						<Link
							href={`/academy/course/${c.slug}`}
							className="flex items-center justify-between gap-4 px-5 py-4 text-slate-900 hover:bg-slate-50"
						>
							<span className="font-medium">{c.title}</span>
							<span className="shrink-0 text-sm text-slate-500">{c.modules} modules</span>
						</Link>
					</li>
				))}
			</ul>
			<p className="mt-8 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					← Home
				</Link>
			</p>
		</main>
	);
}
