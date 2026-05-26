import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Поверителност",
				description: "Кратка страница за поверителност в AgriNexus.",
			}
		: {
				title: "Privacy",
				description: "Privacy placeholder for AgriNexus Next app.",
			};
}

const copy = {
	en: {
		title: "Privacy",
		body: "This is a short placeholder page so footer links work. Replace with your real privacy policy.",
		back: "← Home",
	},
	bg: {
		title: "Поверителност",
		body: "Това е кратка временна страница, за да работят връзките във footer-а. Замени я с реалната политика за поверителност, когато текстът е готов.",
		back: "← Начало",
	},
};

export default async function PrivacyPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto max-w-2xl px-8 py-16 text-ink">
			<h1 className="text-2xl font-semibold">{c.title}</h1>
			<p className="mt-4 text-sm text-ink/70">{c.body}</p>
			<p className="mt-8">
				<Link href="/" className="text-forest-700 underline underline-offset-4">
					{c.back}
				</Link>
			</p>
		</main>
	);
}
