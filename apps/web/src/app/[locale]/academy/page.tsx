import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, ChevronRight, FlaskConical } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { coursesForLocale } from "@/content/academy-courses";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
	const marketingOrigin = (process.env.AGN_MARKETING_ORIGIN ?? "").replace(/\/$/, "");
	const legacyAcademyHref = marketingOrigin ? `${marketingOrigin}/academy.html` : "/academy.html";

	return (
		<main className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
			<header className="max-w-3xl">
				<p className="text-sm font-medium uppercase tracking-wide text-forest-700">{t("kicker")}</p>
				<h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{t("heading")}</h1>
				<p className="mt-4 text-base leading-relaxed text-slate-600">
					{t("intro")}{" "}
					<a
						href={legacyAcademyHref}
						className="font-medium text-forest-700 underline decoration-forest-500/40 underline-offset-4 transition-colors hover:text-forest-900"
						target="_blank"
						rel="noreferrer"
					>
						{t("introLink")}
					</a>
					.
				</p>
			</header>

			<section className="mt-10 grid gap-4 md:grid-cols-2">
				<Button variant="default" size="xl" className="h-auto rounded-xl border-0 bg-forest-700 shadow-md hover:bg-forest-900" asChild>
					<Link href="/academy/lab" className="text-left text-white">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
							<FlaskConical className="size-5 text-white" aria-hidden />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-xs font-semibold uppercase tracking-wide text-forest-200">{t("labLabel")}</span>
							<span className="mt-1 block text-base font-semibold leading-snug">{t("labTitle")}</span>
							<span className="mt-1 block text-sm font-normal text-forest-100/95">{t("labSub")}</span>
						</span>
						<ChevronRight className="size-5 shrink-0 text-forest-200" aria-hidden />
					</Link>
				</Button>

				<Button variant="secondary" size="xl" className="h-auto rounded-xl shadow-sm" asChild>
					<Link href="/academy/lecturer">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700">
							<BookOpen className="size-5" aria-hidden />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("lecturerLabel")}</span>
							<span className="mt-1 block text-base font-semibold leading-snug text-slate-900">{t("lecturerTitle")}</span>
							<span className="mt-1 block text-sm font-normal text-slate-600">{t("lecturerSub")}</span>
						</span>
						<ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
					</Link>
				</Button>
			</section>

			<section className="mt-12" aria-labelledby="academy-courses-heading">
				<h2 id="academy-courses-heading" className="text-lg font-semibold tracking-tight text-slate-900">
					{t("coursesTitle")}
				</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					{courses.map((c) => (
						<Link key={c.slug} href={`/academy/course/${c.slug}`} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
							<Card className="flex h-full flex-col border-slate-200/90 transition-[border-color,box-shadow] group-hover:border-forest-300/80 group-hover:shadow-md">
								<CardHeader className="flex-1 border-0 pb-2">
									<CardTitle className="text-lg leading-snug text-slate-900">{c.title}</CardTitle>
									<CardDescription className="line-clamp-3 text-sm leading-relaxed">{c.description}</CardDescription>
								</CardHeader>
								<CardFooter className="mt-auto justify-between gap-3 border-t border-slate-100 py-3 text-sm">
									<span className="text-slate-500">{t("moduleCount", { count: c.modules })}</span>
									<span className="font-medium text-forest-700">{t("openCourse")}</span>
								</CardFooter>
							</Card>
						</Link>
					))}
				</div>
			</section>

			<p className="mt-10">
				<Button variant="link" className="h-auto p-0 text-forest-700" asChild>
					<Link href="/">{t("homeBack")}</Link>
				</Button>
			</p>
		</main>
	);
}
