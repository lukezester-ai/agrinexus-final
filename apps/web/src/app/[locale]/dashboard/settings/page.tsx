import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";
import { cutoverCopy, productLocale } from "@/lib/product-ux-copy";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: cutoverCopy[productLocale(locale)].settingsTitle };
}

export default async function SettingsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = cutoverCopy[productLocale(locale)];

	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) redirect(`/${locale}/login`);

	const { data: profile } = await supabase.from("farm_profiles").select("user_id, full_name").eq("user_id", session.user.id).maybeSingle();

	return (
		<div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
			<div className="mb-8">
				<div className="text-4xl font-light text-white">{c.settingsTitle}</div>
				<div className="mt-4 text-sm text-white/70">{c.settingsLead}</div>
			</div>
			<div className="border border-white/15 p-5 md:p-7">
				<SettingsForm locale={locale} profile={profile} />
			</div>
		</div>
	);
}
