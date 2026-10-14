import { setRequestLocale } from "next-intl/server";
import { HomeFlow, PublicShell } from "@/components/public/public-site";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<PublicShell locale={locale}>
			<HomeFlow locale={locale} />
		</PublicShell>
	);
}
