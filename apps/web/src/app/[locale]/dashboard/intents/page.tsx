import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import type { BusinessIntent } from "@/lib/business-intents";
import { listCopy, glossary, productLocale } from "@/lib/product-ux-copy";
import { journeyLead, journeyPage, journeyTitle, primaryAction } from "@/components/Dashboard/journey-ui";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: listCopy[productLocale(locale)].intentsTitle };
}

export default async function IntentsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const c = listCopy[productLocale(locale)];
	const g = glossary[productLocale(locale)];
	if (!session) return null;

	const { organizationId } = await ensureUserOrganization(
		supabase,
		session.user.id,
		session.user.email?.split("@")[0] ?? "Organization",
	);

	const { data: rows } = organizationId
		? await supabase
				.from("business_intents")
				.select(
					"id, organization_id, created_by, kind, headline, public_summary, industry, target_markets, visibility, lifecycle, expires_at, published_at, created_at, updated_at",
				)
				.eq("organization_id", organizationId)
				.order("created_at", { ascending: false })
		: { data: [] as BusinessIntent[] };

	const intents = (rows ?? []) as BusinessIntent[];

	return (
		<div className={journeyPage}>
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className={journeyTitle}>{c.intentsTitle}</h1>
					<p className={journeyLead}>{c.intentsLead}</p>
				</div>
				<Link href="/dashboard/intents/new" className={`${primaryAction} shrink-0`}>
					{c.newIntent}
				</Link>
			</div>
			{intents.length === 0 ? (
				<div className="rounded-2xl border border-ink/[0.07] bg-white px-5 py-5">
					<p className="text-[15px] text-ink/55">{c.noIntents}</p>
					<Link href="/dashboard/onboarding" className={`${primaryAction} mt-4`}>
						{c.firstIntent}
					</Link>
				</div>
			) : (
				<ul className="flex flex-col gap-3">
					{intents.map((intent) => (
						<li
							key={intent.id}
							className="rounded-2xl border border-ink/[0.08] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
						>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{intent.headline}</span>
								{intent.visibility === "confidential" ? (
									<span className="rounded-full bg-harvest-50 px-2 py-0.5 text-[11px] font-medium text-harvest-700">
										{g.confidential}
									</span>
								) : (
									<span className="text-[11px] uppercase tracking-wide text-ink/40">{intent.visibility}</span>
								)}
								<span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">
									{intent.kind} · {intent.lifecycle}
								</span>
							</div>
							<div className="mt-1.5 text-[13px] text-ink/55">
								{intent.industry}
								{intent.target_markets.length ? ` · ${intent.target_markets.join(", ")}` : ""}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
