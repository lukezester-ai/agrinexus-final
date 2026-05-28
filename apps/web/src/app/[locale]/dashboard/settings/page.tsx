import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

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
	const subtitle = locale === "bg" ? "Актуализирай своята лична информация и данни за стопанството." : "Update your personal information and farm details.";

	return (
		<div className="px-6 py-5 pb-12 md:px-7 max-w-2xl">
			<div className="mb-6">
				<div className="font-serif text-2xl font-normal leading-[1.1] tracking-[-0.015em] md:text-[26px]">
					{title}
				</div>
				<div className="mt-1.5 text-sm text-ink/60">{subtitle}</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-5 md:p-7">
				<SettingsForm locale={locale} profile={profile} />
			</div>
		</div>
	);
}
