import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import type { BusinessOpportunity } from "@/lib/business-opportunities";
import { listCopy, productLocale } from "@/lib/product-ux-copy";
import { LifecycleActionButton } from "@/components/Dashboard/LifecycleActionButton";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: listCopy[productLocale(locale)].oppsTitle };
}

export default async function OpportunitiesPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const c = listCopy[productLocale(locale)];
	if (!session) return null;
	const { organizationId } = await ensureUserOrganization(
		supabase,
		session.user.id,
		session.user.email?.split("@")[0] ?? "Organization",
	);
	const { data: rows } = organizationId
		? await supabase
				.from("business_opportunities")
				.select(
					"id, organization_id, created_by, source_type, title, summary, industry, target_markets, visibility, lifecycle, facets, created_at, updated_at",
				)
				.eq("organization_id", organizationId)
				.order("created_at", { ascending: false })
		: { data: [] as BusinessOpportunity[] };
	const opportunities = (rows ?? []) as BusinessOpportunity[];
	const { data: membership } = organizationId
		? await supabase
				.from("organization_memberships")
				.select("role")
				.eq("organization_id", organizationId)
				.eq("user_id", session.user.id)
				.maybeSingle()
		: { data: null };
	const role = membership?.role as string | undefined;
	return (
		<div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10 md:py-24">
			<div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-light text-white md:text-5xl">{c.oppsTitle}</h1>
					<p className="mt-4 max-w-xl text-sm text-white/70">{c.oppsLead}</p>
				</div>
				<Link href="/dashboard/opportunities/new" className="border border-white/15 px-4 py-3 text-sm text-white/85 no-underline hover:border-white/40">
					{c.newOpp}
				</Link>
			</div>
			{opportunities.length === 0 ? (
				<p className="text-sm text-white/55">{c.noOpps}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{opportunities.map((row) => (
						<li key={row.id} className="border border-white/15 px-4 py-4">
							<Link href={`/dashboard/opportunities/${row.id}`} className="text-sm text-white no-underline hover:text-white/70">
								{row.title}
							</Link>
							<div className="mt-1 font-mono text-[10px] uppercase text-white/45">
								{row.visibility} · {row.lifecycle} · {row.source_type}
							</div>
							{row.source_type === "manual" && ["draft", "open", "paused", "pursuing"].includes(row.lifecycle) &&
							(role === "owner" || role === "admin" || (role === "member" && row.created_by === session.user.id)) ? (
								<LifecycleActionButton
									fn="transition_business_opportunity_v1"
									args={{ p_opportunity_id: row.id, p_target_lifecycle: "withdrawn" }}
									label="Withdraw"
									confirmMessage="Withdraw this business opportunity? This action is audited."
								/>
							) : null}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
