import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { coursesForLocale } from "@/content/academy-courses";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "Academy" });
	return {
		title: t("metaTitle"),
		description: t("metaDescription"),
	};
}

export default async function AcademyHubPage({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("Academy");
	const loc = locale as AppLocale;
	const courses = coursesForLocale(loc);

	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{t("kicker")}</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{t("heading")}</h1>
			<p className="mt-3 text-slate-600">
				{t("intro")}{" "}
				<a
					href="http://127.0.0.1:3456/academy.html"
					className="font-medium text-emerald-800 underline underline-offset-4"
					target="_blank"
					rel="noreferrer"
				>
					{t("introLink")}
				</a>
				.
			</p>

			<Link
				href="/academy/lab"
				className="mt-8 flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100"
			>
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("labLabel")}</p>
					<p className="font-semibold">{t("labTitle")}</p>
					<p className="mt-1 text-sm text-emerald-900/90">{t("labSub")}</p>
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
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("lecturerLabel")}</p>
					<p className="font-semibold">{t("lecturerTitle")}</p>
					<p className="mt-1 text-sm text-slate-600">{t("lecturerSub")}</p>
				</div>
				<span className="text-2xl" aria-hidden>
					→
				</span>
			</Link>

			<ul className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
				{courses.map((c) => (
					<li key={c.slug}>
						<Link
							href={`/academy/course/${c.slug}`}
							className="flex flex-col gap-1 px-5 py-4 text-slate-900 hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
						>
							<div>
								<span className="font-medium">{c.title}</span>
								<p className="mt-1 text-sm text-slate-600">{c.description}</p>
							</div>
							<span className="shrink-0 text-sm text-slate-500 sm:pt-0.5">{t("moduleCount", { count: c.modules })}</span>
						</Link>
					</li>
				))}
			</ul>
			<p className="mt-8 flex flex-wrap gap-4 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					{t("homeBack")}
				</Link>
			</p>
		</main>
	);
}
