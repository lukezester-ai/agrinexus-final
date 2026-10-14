import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PublicShell } from "@/components/public/public-site";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Поверителност",
				description: "Как публичните страници и акаунтът в радара пазят въведеното.",
			}
		: {
				title: "Privacy",
				description: "How the public pages and a radar account handle what you enter.",
			};
}

const copy = {
	en: {
		title: "Privacy",
		body: "The public pages can be read without an account. A radar account stores the organization profile and the business records you enter. The site does not ask for brokerage credentials.",
		back: "← Home",
	},
	bg: {
		title: "Поверителност",
		body: "Публичните страници се четат без акаунт. Акаунтът в радара пази профила на организацията и бизнес записите, които въвеждаш. Сайтът не иска брокерски данни за достъп.",
		back: "← Начало",
	},
};

export default async function PrivacyPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<PublicShell locale={locale}>
			<main className="mx-auto max-w-2xl px-8 py-16 text-white">
				<h1 className="text-3xl font-light">{c.title}</h1>
				<p className="mt-4 text-sm text-white/70">{c.body}</p>
				<p className="mt-8">
					<Link href="/" className="text-white/70 no-underline hover:text-white">
						{c.back}
					</Link>
				</p>
			</main>
		</PublicShell>
	);
}
