import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { AcademyLecturer } from "@/components/academy-lecturer";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Лектор · Академия · AgriNexus",
				description: "Лекции с гласно четене и въпроси към Academy Tutor API.",
			}
		: {
				title: "Lecturer · Academy · AgriNexus",
				description: "Lectures with read-aloud and questions to the Academy Tutor API.",
			};
}

const copy = {
	en: {
		kicker: "AgriNexus · Academy",
		title: "Lecturer and materials",
		introBefore: "Lectures load from",
		introMiddle: "catalog in",
		introAfter:
			". A URL with ?focus=<id> selects a lecture on load. AI answers require the root dev server",
		introEnd: "and MISTRAL_API_KEY.",
		loading: "Loading lecturer…",
		backAcademy: "← Academy",
		lab: "Lab (simulation)",
	},
	bg: {
		kicker: "AgriNexus · Академия",
		title: "Лектор и материали",
		introBefore: "Лекциите се зареждат от",
		introMiddle: "каталогът е в",
		introAfter:
			". URL с ?focus=<id> избира лекция при зареждане. За AI отговорите е нужен кореновият dev сървър",
		introEnd: "и MISTRAL_API_KEY.",
		loading: "Зареждане на лектора…",
		backAcademy: "← Академия",
		lab: "Лаборатория (симулация)",
	},
};

export default async function AcademyLecturerPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{c.kicker}</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{c.title}</h1>
			<p className="mt-3 text-slate-600">
				{c.introBefore} <code className="rounded bg-slate-200 px-1">public/lectures/courses/.../*.md</code> ({c.introMiddle}{" "}
				<code className="rounded bg-slate-200 px-1">src/content/academy-courses.ts</code>){c.introAfter}{" "}
				<code className="rounded bg-slate-200 px-1">npm run dev</code> (3456) {c.introEnd}
			</p>

			<Suspense fallback={<p className="mt-6 text-sm text-slate-600">{c.loading}</p>}>
				<AcademyLecturer />
			</Suspense>

			<p className="mt-12 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">{c.backAcademy}</Link>
				<Link href="/academy/lab" className="text-emerald-800 underline underline-offset-4">{c.lab}</Link>
			</p>
		</main>
	);
}
