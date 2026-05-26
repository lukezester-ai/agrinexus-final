import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { SiteNav } from "@/components/site-nav";
import { routing } from "@/i18n/routing";

const inter = Inter({
	subsets: ["latin", "latin-ext"],
	weight: ["400", "500", "600"],
	variable: "--font-inter",
	display: "swap",
});

const fraunces = Fraunces({
	subsets: ["latin", "latin-ext"],
	style: ["normal", "italic"],
	weight: ["400"],
	variable: "--font-fraunces",
	display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin", "latin-ext"],
	weight: ["400", "500"],
	variable: "--font-mono",
	display: "swap",
});

const fontVariables = [inter.variable, fraunces.variable, jetbrainsMono.variable].join(" ");

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

type LayoutProps = {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
	const { locale } = await params;
	if (!hasLocale(routing.locales, locale)) {
		return { title: "AgriNexus" };
	}
	setRequestLocale(locale);
	const t = await getTranslations({ locale, namespace: "Metadata" });

	return {
		metadataBase: new URL("https://agrinexus.io"),
		title: {
			default: t("titleDefault"),
			template: t("titleTemplate"),
		},
		description: t("description"),
		keywords: t.raw("keywords"),
		authors: [{ name: "AgriNexus" }],
		openGraph: {
			title: t("ogTitle"),
			description: t("ogDescription"),
			url: "https://agrinexus.io",
			siteName: "AgriNexus",
			locale: locale === "bg" ? "bg_BG" : "en_US",
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title: t("ogTitle"),
			description: t("ogDescription"),
		},
		robots: { index: true, follow: true },
	};
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
	const { locale } = await params;
	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}
	setRequestLocale(locale);
	const messages = await getMessages();

	return (
		<html lang={locale} className={fontVariables}>
			<body className="min-h-screen font-sans">
				<NextIntlClientProvider locale={locale} messages={messages}>
					<div className="aurora" aria-hidden="true" />
					<div className="grain" aria-hidden="true" />
					<div className="relative z-[2] flex min-h-screen flex-col">
						<SiteNav />
						<div className="flex-1">{children}</div>
						<Footer />
					</div>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
