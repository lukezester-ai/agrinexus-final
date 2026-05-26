import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { SiteNav } from "@/components/site-nav";

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

export const metadata: Metadata = {
	metadataBase: new URL("https://agrinexus.io"),
	title: {
		default: "AgriNexus — From soil to market. For every farmer.",
		template: "%s — AgriNexus",
	},
	description:
		"An open AI intelligence platform for modern farming — free for every farmer, funded by partners.",
	keywords: [
		"agritech",
		"AI for farmers",
		"farm management",
		"commodity intelligence",
		"precision agriculture",
		"satellite monitoring",
		"agricultural AI",
	],
	authors: [{ name: "AgriNexus" }],
	openGraph: {
		title: "AgriNexus — From soil to market. For every farmer.",
		description:
			"An open AI intelligence platform for modern farming — free for every farmer, funded by partners.",
		url: "https://agrinexus.io",
		siteName: "AgriNexus",
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "AgriNexus — From soil to market. For every farmer.",
		description:
			"An open AI intelligence platform for modern farming — free for every farmer, funded by partners.",
	},
	robots: { index: true, follow: true },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={fontVariables}>
			<body className="min-h-screen font-sans">
				<div className="aurora" aria-hidden="true" />
				<div className="grain" aria-hidden="true" />
				<div className="relative z-[2] flex min-h-screen flex-col">
					<SiteNav />
					<div className="flex-1">{children}</div>
					<Footer />
				</div>
			</body>
		</html>
	);
}
