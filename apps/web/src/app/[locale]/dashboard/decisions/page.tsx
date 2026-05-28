import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DecisionDiaryManager from "@/components/decision-diary/DecisionDiaryManager";
import { parseBreakEvenInputs } from "@/lib/break-even";
import { parseDecisionRow, type DecisionDiaryEntry } from "@/lib/decision-diary";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? { title: "Дневник на решения" }
		: { title: "Decision diary" };
}

export default async function DecisionsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) redirect(`/${locale}/login`);

	const [{ data: profile }, { data: rows }] = await Promise.all([
		supabase
			.from("farm_profiles")
			.select("break_even_inputs, total_ha")
			.eq("user_id", session.user.id)
			.single(),
		supabase
			.from("decision_diary_entries")
			.select("*")
			.eq("user_id", session.user.id)
			.order("decided_at", { ascending: false })
			.limit(100),
	]);

	const breakEven = parseBreakEvenInputs(profile?.break_even_inputs);
	const totalHa = Number(profile?.total_ha) || 0;

	const initialEntries: DecisionDiaryEntry[] = (rows ?? [])
		.map((row) => parseDecisionRow(row as Record<string, unknown>))
		.filter((e): e is DecisionDiaryEntry => e != null);

	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12">
			<DecisionDiaryManager
				locale={locale}
				initialEntries={initialEntries}
				breakEven={breakEven}
				totalHa={totalHa}
			/>
		</div>
	);
}
