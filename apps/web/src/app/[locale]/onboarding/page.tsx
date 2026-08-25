import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ locale: string }> };

/** Farm-profile onboarding is not part of the product. Intent onboarding lives under dashboard. */
export default async function LegacyFarmOnboarding({ params }: PageProps) {
	const { locale } = await params;
	redirect(`/${locale}/dashboard/onboarding`);
}
