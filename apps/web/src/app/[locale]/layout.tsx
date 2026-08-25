import "../globals.css";
import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MarketingChrome } from "@/components/MarketingChrome";
import { routing } from "@/i18n/routing";

/** Next.js 15+: viewport must not live inside `metadata` / `generateMetadata`. */
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
};

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
			locale: locale === "ar" ? "ar_SA" : locale === "bg" ? "bg_BG" : "en_US",
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
		<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
			<body className="min-h-screen font-sans">
				<NextIntlClientProvider locale={locale} messages={messages}>
					<div className="aurora" aria-hidden="true" />
					<div className="grain" aria-hidden="true" />
					<MarketingChrome>{children}</MarketingChrome>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
