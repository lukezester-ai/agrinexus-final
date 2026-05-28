import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { SettingsFormWithBreakEven } from "./SettingsForm";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? { title: "Настройки" }
		: { title: "Settings" };
}

export default async function SettingsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const supabase = createClient();
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) redirect(`/${locale}/login`);

	const { data: profile } = await supabase
		.from("farm_profiles")
		.select("*")
		.eq("user_id", session.user.id)
		.single();

	const title = locale === "bg" ? "Настройки на профила" : "Profile Settings";
	const subtitle =
		locale === "bg"
			? "Профил, себестойност, местни купувачи (€/лв) и Telegram briefing."
			: "Profile, break-even, local buyers (EUR/BGN), and Telegram briefing.";

	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12 max-w-2xl">
			<div className="mb-6">
				<div className="font-serif text-2xl font-normal leading-[1.1] tracking-[-0.015em] md:text-[26px]">
					{title}
				</div>
				<div className="mt-1.5 text-sm text-ink/60">{subtitle}</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-5 md:p-7">
				<SettingsFormWithBreakEven locale={locale} profile={profile} />
			</div>
		</div>
	);
}
