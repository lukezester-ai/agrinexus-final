import { setRequestLocale } from "next-intl/server";
import { FinanceDesk } from "@/components/finance/FinanceDesk";

export default async function FinancePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	setRequestLocale(locale);
	return <FinanceDesk />;
}
