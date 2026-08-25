import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import { FirstIntentForm } from "@/components/Dashboard/FirstIntentForm";
import { onboardingCopy, productLocale } from "@/lib/product-ux-copy";
import { alertError, journeyKicker, journeyLead, journeyPage, journeyTitle } from "@/components/Dashboard/journey-ui";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	const c = onboardingCopy[productLocale(locale)];
	return { title: c.title, description: c.lead };
}

export default async function OnboardingPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = onboardingCopy[productLocale(locale)];
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

	return (
		<div className={journeyPage}>
			<p className={journeyKicker}>{c.kicker}</p>
			<h1 className={journeyTitle}>{c.title}</h1>
			<p className={journeyLead}>{c.lead}</p>
			<div className="mt-8">
				{error || !organizationId ? (
					<p className={alertError} role="alert">
						{error ?? c.orgRequired}
					</p>
				) : (
					<FirstIntentForm organizationId={organizationId} userId={session.user.id} locale={locale} />
				)}
			</div>
		</div>
	);
}
