import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CoreChat } from "@/components/chat/CoreChat";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: "Ask" };
}

export default async function DashboardAskPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<div className="px-3 py-3 md:px-7 md:py-5 max-w-3xl mx-auto w-full">
			<CoreChat locale={locale} mobileFill />
		</div>
	);
}
