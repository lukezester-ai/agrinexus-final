import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AgriNexusChat } from "@/components/chat/AgriNexusChat";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? { title: "Попитай AgriNexus" }
		: { title: "Ask AgriNexus" };
}

export default async function AskPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
			<AgriNexusChat locale={locale} />
		</main>
	);
}
