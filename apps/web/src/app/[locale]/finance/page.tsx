import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { FinanceDesk } from "@/components/finance/FinanceDesk";
import { FinanceLanding } from "@/components/finance/FinanceLanding";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Finance Intelligence" };

export default async function FinancePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session?.user?.id) return <FinanceLanding />;

	const organization = await ensureUserOrganization(
		supabase,
		session.user.id,
		session.user.email?.split("@")[0] || "Finance",
	);
	return <FinanceDesk organizationId={organization.organizationId} organizationError={organization.error} />;
}
