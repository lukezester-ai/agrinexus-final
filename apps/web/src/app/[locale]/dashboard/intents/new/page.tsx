import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import { IntentCreateForm } from "../IntentCreateForm";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg" ? { title: "Ново намерение" } : { title: "New intent" };
}

export default async function NewIntentPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) return null;

	const { organizationId, error } = await ensureUserOrganization(
		supabase,
		session.user.id,
		session.user.email?.split("@")[0] ?? "Organization",
	);
	const isBg = locale === "bg";

	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12">
			<h1 className="mb-6 font-serif text-2xl text-ink md:text-[26px]">
				{isBg ? "Ново бизнес намерение" : "New business intent"}
			</h1>
			{error || !organizationId ? (
				<p className="text-sm text-red-800">{error ?? "Organization required"}</p>
			) : (
				<IntentCreateForm locale={locale} organizationId={organizationId} userId={session.user.id} />
			)}
		</div>
	);
}
