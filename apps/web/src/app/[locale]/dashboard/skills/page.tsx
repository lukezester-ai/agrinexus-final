import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/ensure-organization";
import { normalizeSkill, SKILL_SELECT_COLUMNS, type OrganizationSkill } from "@/lib/skills";
import { productLocale, skillsCopy } from "@/lib/product-ux-copy";
import { journeyLead, journeyPage, journeyTitle, primaryAction } from "@/components/Dashboard/journey-ui";
import { LifecycleActionButton } from "@/components/Dashboard/LifecycleActionButton";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: skillsCopy[productLocale(locale)].title };
}

export default async function SkillsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const c = skillsCopy[productLocale(locale)];
	if (!session) return null;

	const { organizationId } = await ensureUserOrganization(
		supabase,
		session.user.id,
		session.user.email?.split("@")[0] ?? "Organization",
	);

	const { data: rows } = organizationId
		? await supabase
				.from("organization_skills")
				.select(SKILL_SELECT_COLUMNS)
				.eq("organization_id", organizationId)
				.order("created_at", { ascending: false })
		: { data: [] as Record<string, unknown>[] };

	const skills: OrganizationSkill[] = ((rows ?? []) as Record<string, unknown>[]).map(normalizeSkill);

	const { data: membership } = organizationId
		? await supabase
				.from("organization_memberships")
				.select("role")
				.eq("organization_id", organizationId)
				.eq("user_id", session.user.id)
				.maybeSingle()
		: { data: null };
	const role = membership?.role as string | undefined;
	const canWrite = role === "owner" || role === "admin" || role === "member";

	return (
		<div className={journeyPage}>
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className={journeyTitle}>{c.title}</h1>
					<p className={journeyLead}>{c.lead}</p>
				</div>
				{canWrite ? (
					<Link href="/dashboard/skills/new" className={`${primaryAction} shrink-0`}>
						{c.newSkill}
					</Link>
				) : null}
			</div>
			{skills.length === 0 ? (
				<div className="border border-white/15 px-5 py-5">
					<p className="text-sm text-white/55">{c.noSkills}</p>
					{canWrite ? (
						<Link href="/dashboard/skills/new" className={`${primaryAction} mt-4`}>
							{c.firstSkill}
						</Link>
					) : null}
				</div>
			) : (
				<ul className="flex flex-col gap-3">
					{skills.map((skill) => (
						<li key={skill.id} className="border border-white/15 px-5 py-4">
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="text-[15px] text-white">{skill.name}</span>
								<span className="text-[11px] uppercase tracking-wide text-white/45">
									{c.status[skill.status]}
								</span>
								<span className="font-mono text-[10px] uppercase tracking-wide text-white/45">
									{skill.steps.length} · {skill.guardrails.length}
								</span>
							</div>
							{skill.description ? (
								<div className="mt-1.5 text-[13px] text-white/55">{skill.description}</div>
							) : null}
							{skill.when_to_use ? (
								<div className="mt-2 text-[12px] text-white/45">
									{c.whenToUse}: {skill.when_to_use}
								</div>
							) : null}
							{skill.steps.length ? (
								<div className="mt-3">
									<div className="text-[11px] tracking-[0.18em] text-white/45">{c.steps}</div>
									<ol className="mt-1.5 list-decimal space-y-1 ps-4 text-[13px] text-white/70">
										{skill.steps.map((step, index) => (
											<li key={`${skill.id}-step-${index}`}>
												<span className="text-white/85">{step.title}</span>
												{step.detail ? ` — ${step.detail}` : ""}
											</li>
										))}
									</ol>
								</div>
							) : null}
							{skill.guardrails.length ? (
								<div className="mt-3">
									<div className="text-[11px] tracking-[0.18em] text-white/45">{c.guardrails}</div>
									<ul className="mt-1.5 list-disc space-y-1 ps-4 text-[13px] text-white/55">
										{skill.guardrails.map((item) => (
											<li key={`${skill.id}-guardrail-${item}`}>{item}</li>
										))}
									</ul>
								</div>
							) : null}
							{canWrite &&
							(role === "owner" || role === "admin" || skill.created_by === session.user.id) ? (
								<div className="flex flex-wrap gap-2">
									{skill.status === "draft" ? (
										<LifecycleActionButton
											fn="transition_organization_skill_v1"
											args={{ p_skill_id: skill.id, p_target_status: "active" }}
											label={c.activate}
											confirmMessage={c.activateConfirm}
										/>
									) : null}
									{skill.status !== "archived" ? (
										<LifecycleActionButton
											fn="transition_organization_skill_v1"
											args={{ p_skill_id: skill.id, p_target_status: "archived" }}
											label={c.archive}
											confirmMessage={c.archiveConfirm}
										/>
									) : null}
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
