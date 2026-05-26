import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { AcademyLecturer } from "@/components/academy-lecturer";

export const metadata = {
	title: "Лектор · Академия · AgriNexus",
	description: "Лекции с гласно четене и въпроси към Academy Tutor API.",
};

export default function AcademyLecturerPage() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · Академия</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Лектор и материали</h1>
			<p className="mt-3 text-slate-600">
				Лекциите се зареждат от <code className="rounded bg-slate-200 px-1">public/lectures/courses/…/*.md</code> (каталог в{" "}
				<code className="rounded bg-slate-200 px-1">src/content/academy-courses.ts</code>). URL с{" "}
				<code className="rounded bg-slate-200 px-1">?focus=&lt;id&gt;</code> избира лекция при зареждане. Нужен е коренов{" "}
				<code className="rounded bg-slate-200 px-1">npm run dev</code> (3456) и <code className="rounded bg-slate-200 px-1">MISTRAL_API_KEY</code> за AI отговорите.
			</p>

			<Suspense fallback={<p className="mt-6 text-sm text-slate-600">Зареждане на лектора…</p>}>
				<AcademyLecturer />
			</Suspense>

			<p className="mt-12 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					← Академия
				</Link>
				<Link href="/academy/lab" className="text-emerald-800 underline underline-offset-4">
					Лаборатория (симулация)
				</Link>
			</p>
		</main>
	);
}
