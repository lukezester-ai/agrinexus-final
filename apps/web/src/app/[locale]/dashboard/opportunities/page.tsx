import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import type { BusinessOpportunity } from "@/lib/business-opportunities";
import { listCopy, productLocale } from "@/lib/product-ux-copy";

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
	return (
		<div className="px-4 py-4 pb-6 md:px-7 md:py-5 md:pb-12">
			<div className="mb-6 flex items-end justify-between gap-4">
				<div>
					<h1 className="font-serif text-2xl text-ink md:text-[26px]">
						{c.oppsTitle}
					</h1>
					<p className="mt-2 max-w-xl text-sm text-ink/60">
						{c.oppsLead}
					</p>
				</div>
				<Link
					href="/dashboard/opportunities/new"
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white no-underline"
				>
					{c.newOpp}
				</Link>
			</div>
			{opportunities.length === 0 ? (
				<p className="text-sm text-ink/50">{c.noOpps}</p>
			) : (
				<ul className="flex flex-col gap-2">
					{opportunities.map((row) => (
						<li key={row.id} className="rounded-2xl border border-ink/[0.06] bg-white/55 px-4 py-3.5">
							<div className="text-sm font-medium text-ink">{row.title}</div>
							<div className="mt-1 font-mono text-[10px] uppercase text-ink/45">
								{row.visibility} · {row.lifecycle} · {row.source_type}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
