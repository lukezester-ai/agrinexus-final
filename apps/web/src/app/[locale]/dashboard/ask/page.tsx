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

export default async function DashboardAskPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<div className="px-3 py-3 md:px-7 md:py-5 max-w-3xl mx-auto w-full">
			<AgriNexusChat locale={locale} mobileFill />
		</div>
	);
}
