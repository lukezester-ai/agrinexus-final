import Link from "next/link";
import { COURSES } from "@/content/academy-courses";

export const metadata = {
	title: "Академия · AgriNexus",
	description: "Курсове и лаборатория (учебни сценарии).",
};

export default function AcademyHubPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · Академия</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Обучение</h1>
			<p className="mt-3 text-slate-600">
				Пет учебни курса с готови лекции (Markdown),{" "}
				<strong>лаборатория</strong> за симулация и страница <strong>Лектор</strong> с четене на глас и въпроси към AI. Статичната
				библиотека на маркетинг сървъра:{" "}
				<a
					href="http://127.0.0.1:3456/academy.html"
					className="font-medium text-emerald-800 underline underline-offset-4"
					target="_blank"
					rel="noreferrer"
				>
					academy.html
				</a>
				.
			</p>

			<Link
				href="/academy/lab"
				className="mt-8 flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100"
			>
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Лаборатория</p>
					<p className="font-semibold">Симулация: почва, време, разходи, добив, плюс/минус</p>
					<p className="mt-1 text-sm text-emerald-900/90">Учебен модел — проба и грешка с плъзгачи.</p>
				</div>
				<span className="text-2xl" aria-hidden>
					→
				</span>
			</Link>

			<Link
				href="/academy/lecturer"
				className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
			>
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Лектор</p>
					<p className="font-semibold">Материали от .md + четене на глас + въпроси към AI (Academy Tutor)</p>
					<p className="mt-1 text-sm text-slate-600">
						Файлове в <code className="rounded bg-slate-100 px-1">public/lectures/courses/</code> — каталог в{" "}
						<code className="rounded bg-slate-100 px-1">src/content/academy-courses.ts</code>.
					</p>
				</div>
				<span className="text-2xl" aria-hidden>
					→
				</span>
			</Link>

			<ul className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
				{COURSES.map((c) => (
					<li key={c.slug}>
						<Link
							href={`/academy/course/${c.slug}`}
							className="flex flex-col gap-1 px-5 py-4 text-slate-900 hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
						>
							<div>
								<span className="font-medium">{c.title}</span>
								<p className="mt-1 text-sm text-slate-600">{c.description}</p>
							</div>
							<span className="shrink-0 text-sm text-slate-500 sm:pt-0.5">{c.modules} модула</span>
						</Link>
					</li>
				))}
			</ul>
			<p className="mt-8 flex flex-wrap gap-4 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					← Начало (Next)
				</Link>
			</p>
		</main>
	);
}
