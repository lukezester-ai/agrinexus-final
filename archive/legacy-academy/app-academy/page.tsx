import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, ChevronRight, FlaskConical, MapPinned, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { coursesForLocale } from "@/content/academy-courses";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { AcademyCourseStagger, AcademyFeatureTiles } from "@/components/motion/academy-hub-motion";

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
	const courseRows = courses.map((c) => ({
		slug: c.slug,
		title: c.title,
		description: c.description,
		modulesLine: t("moduleCount", { count: c.modules }),
	}));
	const marketingOrigin = (process.env.AGN_MARKETING_ORIGIN ?? "").replace(/\/$/, "");
	const legacyAcademyHref = marketingOrigin ? `${marketingOrigin}/academy.html` : "/academy.html";

	const tileGrid =
		"mt-10 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4";

	return (
		<main className="mx-auto min-w-0 max-w-5xl px-6 py-14 sm:py-16">
			<FadeIn className="max-w-3xl">
				<header>
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
			</FadeIn>

			<AcademyFeatureTiles
				className={tileGrid}
				lab={
					<Button
						variant="default"
						size="xl"
						className="h-auto min-w-0 max-w-full rounded-xl border border-white/25 bg-forest-800/75 shadow-lg backdrop-blur-xl ring-1 ring-white/15 hover:bg-forest-900/85 hover:ring-white/25"
						asChild
					>
						<Link href="/academy/lab" className="min-w-0 max-w-full text-left text-white [overflow-wrap:anywhere]">
							<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
								<FlaskConical className="size-5 text-white" aria-hidden />
							</span>
							<span className="min-w-0 max-w-full flex-1 basis-0">
								<span className="block text-xs font-semibold uppercase tracking-wide text-forest-200">{t("labLabel")}</span>
								<span className="mt-1 block text-base font-medium leading-snug">{t("labTitle")}</span>
								<span className="mt-1 block text-sm font-normal leading-snug text-forest-100/95">{t("labSub")}</span>
							</span>
							<ChevronRight className="mt-1 size-5 shrink-0 self-start text-forest-200" aria-hidden />
						</Link>
					</Button>
				}
				lecturer={
					<Button
						variant="secondary"
						size="xl"
						className="h-auto min-w-0 max-w-full rounded-xl border border-white/55 bg-white/35 shadow-md backdrop-blur-xl ring-1 ring-white/45 hover:bg-white/50 hover:ring-white/60"
						asChild
					>
						<Link href="/academy/lecturer" className="min-w-0 max-w-full [overflow-wrap:anywhere]">
							<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/45 text-forest-700 ring-1 ring-white/50 backdrop-blur-sm">
								<BookOpen className="size-5" aria-hidden />
							</span>
							<span className="min-w-0 max-w-full flex-1 basis-0">
								<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t("lecturerLabel")}</span>
								<span className="mt-1 block text-base font-medium leading-snug text-slate-900">{t("lecturerTitle")}</span>
								<span className="mt-1 block text-sm font-normal leading-snug text-slate-600">{t("lecturerSub")}</span>
							</span>
							<ChevronRight className="mt-1 size-5 shrink-0 self-start text-slate-400" aria-hidden />
						</Link>
					</Button>
				}
				maps={
					<Button
						variant="secondary"
						size="xl"
						className="h-auto min-w-0 max-w-full rounded-xl border border-forest-700/20 bg-forest-900/10 shadow-md backdrop-blur-xl ring-1 ring-forest-800/15 hover:bg-forest-900/15 hover:ring-forest-800/25"
						asChild
					>
						<Link href="/academy/maps" className="min-w-0 max-w-full text-left text-slate-900 [overflow-wrap:anywhere]">
							<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-forest-800/15 text-forest-800 ring-1 ring-forest-700/20 backdrop-blur-sm">
								<MapPinned className="size-5" aria-hidden />
							</span>
							<span className="min-w-0 max-w-full flex-1 basis-0">
								<span className="block text-xs font-semibold uppercase tracking-wide text-forest-800">{t("mapsLabel")}</span>
								<span className="mt-1 block text-base font-medium leading-snug">{t("mapsTitle")}</span>
								<span className="mt-1 block text-sm font-normal leading-snug text-slate-700">{t("mapsSub")}</span>
							</span>
							<ChevronRight className="mt-1 size-5 shrink-0 self-start text-forest-700/70" aria-hidden />
						</Link>
					</Button>
				}
				community={
					<Button
						variant="secondary"
						size="xl"
						className="h-auto min-w-0 max-w-full rounded-xl border border-violet-500/25 bg-violet-600/10 shadow-md backdrop-blur-xl ring-1 ring-violet-500/20 hover:bg-violet-600/15"
						asChild
					>
						<Link href="/community" className="min-w-0 max-w-full text-left text-slate-900 [overflow-wrap:anywhere]">
							<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-900 ring-1 ring-violet-500/25 backdrop-blur-sm">
								<Users className="size-5" aria-hidden />
							</span>
							<span className="min-w-0 max-w-full flex-1 basis-0">
								<span className="block text-xs font-semibold uppercase tracking-wide text-violet-900">{t("communityLabel")}</span>
								<span className="mt-1 block text-base font-medium leading-snug">{t("communityTitle")}</span>
								<span className="mt-1 block text-sm font-normal leading-snug text-slate-700">{t("communitySub")}</span>
							</span>
							<ChevronRight className="mt-1 size-5 shrink-0 self-start text-violet-700/70" aria-hidden />
						</Link>
					</Button>
				}
			/>

			<FadeIn className="mt-12" delay={0.08}>
				<section aria-labelledby="academy-courses-heading">
					<h2 id="academy-courses-heading" className="text-lg font-semibold tracking-tight text-slate-900">
						{t("coursesTitle")}
					</h2>
					<AcademyCourseStagger className="mt-4 grid gap-4 sm:grid-cols-2" courses={courseRows} openCourse={t("openCourse")} />
				</section>
			</FadeIn>

			<FadeIn className="mt-10" delay={0.12}>
				<p>
					<Button variant="link" className="h-auto p-0 text-forest-700" asChild>
						<Link href="/">{t("homeBack")}</Link>
					</Button>
				</p>
			</FadeIn>
		</main>
	);
}
