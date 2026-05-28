import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ locale: string }> };

/** Legacy preview URL — real mobile UI is responsive dashboard + bottom nav. */
export default async function DashboardMobileRedirect({ params }: PageProps) {
	const { locale } = await params;
	redirect(`/${locale}/dashboard`);
}
