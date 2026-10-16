import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import { SkillCreateForm } from "../SkillCreateForm";
import type { ProductLocale } from "@/lib/product-ux-copy";

type PageProps = { params: Promise<{ locale: string }> };

const titles: Record<ProductLocale, string> = {
	en: "New skill",
	bg: "Ново умение",
	ar: "مهارة جديدة",
};

const headings: Record<ProductLocale, string> = {
	en: "Describe what you want",
	bg: "Опишете какво искате",
	ar: "اكتب ما تريده",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: locale === "bg" ? titles.bg : locale === "ar" ? titles.ar : titles.en };
}

export default async function NewSkillPage({ params }: PageProps) {
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
	const heading = locale === "bg" ? headings.bg : locale === "ar" ? headings.ar : headings.en;

	return (
		<div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
			<h1 className="mb-8 text-4xl font-light text-white">{heading}</h1>
			{error || !organizationId ? (
				<p className="text-sm text-red-800">{error ?? "Organization required"}</p>
			) : (
				<SkillCreateForm locale={locale} organizationId={organizationId} userId={session.user.id} />
			)}
		</div>
	);
}
