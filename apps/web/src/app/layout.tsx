import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "AgriNexus App",
	description: "Next.js frontend for AgriNexus (dev scaffold)",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="min-h-screen antialiased">{children}</body>
		</html>
	);
}
