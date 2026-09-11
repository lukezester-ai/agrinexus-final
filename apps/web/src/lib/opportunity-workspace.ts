import { createClient } from "@/lib/supabase-server";
import { parseMatchReasons } from "@/lib/business-radar";
import type {
	BusinessOpportunity,
	OpportunityWorkspace,
	OpportunityWorkspaceEvent,
	OpportunityWorkspaceMatch,
} from "@/lib/business-opportunities";

type MatchRow = {
	id: string;
	lifecycle: string;
	score: number | string;
	confidence: number | string;
	reasons: unknown;
};

export async function loadOpportunityWorkspace(id: string): Promise<OpportunityWorkspace | null> {
	const supabase = createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data: opportunityRow, error } = await supabase
		.from("business_opportunities")
		.select(
			"id, organization_id, created_by, source_type, title, summary, industry, target_markets, visibility, lifecycle, facets, created_at, updated_at",
		)
		.eq("id", id)
		.maybeSingle();
	if (error || !opportunityRow) return null;

	const opportunity = opportunityRow as BusinessOpportunity;
	const { count: membershipCount } = opportunity.organization_id
		? await supabase
				.from("organization_memberships")
				.select("organization_id", { count: "exact", head: true })
				.eq("organization_id", opportunity.organization_id)
				.eq("user_id", user.id)
		: { count: 0 };
	const isOwnerOrganization = (membershipCount ?? 0) > 0;

	const [{ data: secretRow }, { data: matchRows }, { data: auditRows }] = await Promise.all([
		isOwnerOrganization
			? supabase
					.from("business_opportunity_secrets")
					.select("private_brief")
					.eq("opportunity_id", id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		supabase
			.from("business_matches")
			.select("id, lifecycle, score, confidence, reasons")
			.eq("opportunity_id", id)
			.order("score", { ascending: false }),
		isOwnerOrganization
			? supabase
					.from("organization_audit_log")
					.select("id, action, details, created_at")
					.eq("subject_id", id)
					.order("created_at", { ascending: false })
			: Promise.resolve({ data: [] }),
	]);

	const rawMatches = (matchRows ?? []) as MatchRow[];
	const matchIds = rawMatches.map((row) => row.id);
	const [{ data: introductionRows }, { data: relationshipRows }, { data: matchEventRows }] =
		matchIds.length > 0
			? await Promise.all([
					supabase
						.from("business_match_introductions")
						.select("id, match_id, status")
						.in("match_id", matchIds),
					supabase
						.from("business_relationships")
						.select("id, origin_match_id, status")
						.in("origin_match_id", matchIds),
					supabase
						.from("business_match_events")
						.select("id, match_id, kind, from_lifecycle, to_lifecycle, created_at")
						.in("match_id", matchIds)
						.order("created_at", { ascending: false }),
				])
			: [{ data: [] }, { data: [] }, { data: [] }];

	const introductions = new Map(
		(introductionRows ?? []).map((row) => [String(row.match_id), String(row.status)]),
	);
	const relationships = new Map(
		(relationshipRows ?? []).map((row) => [
			String(row.origin_match_id),
			{ id: String(row.id), status: String(row.status) },
		]),
	);
	const matches: OpportunityWorkspaceMatch[] = rawMatches.map((row) => {
		const relationship = relationships.get(row.id);
		return {
			id: row.id,
			lifecycle: row.lifecycle,
			score: Number(row.score),
			confidence: Number(row.confidence),
			reasons: parseMatchReasons(row.reasons),
			introductionStatus: introductions.get(row.id) ?? null,
			relationshipId: relationship?.id ?? null,
			relationshipStatus: relationship?.status ?? null,
		};
	});

	const timeline: OpportunityWorkspaceEvent[] = [
		...(auditRows ?? []).map((row) => ({
			id: `audit:${row.id}`,
			kind: String(row.action),
			createdAt: String(row.created_at),
			detail:
				row.details && typeof row.details === "object"
					? [row.details.from, row.details.to].filter(Boolean).join(" → ") || null
					: null,
		})),
		...(matchEventRows ?? []).map((row) => ({
			id: `match:${row.id}`,
			kind: String(row.kind),
			createdAt: String(row.created_at),
			detail: [row.from_lifecycle, row.to_lifecycle].filter(Boolean).join(" → ") || null,
		})),
	].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

	const recommendations: string[] = [];
	if (!opportunity.summary.trim()) recommendations.push("Add a public-safe summary");
	if (!opportunity.industry.trim()) recommendations.push("Add an industry");
	if (!opportunity.target_markets.length) recommendations.push("Add target markets");
	const kind = typeof opportunity.facets?.kind === "string" ? opportunity.facets.kind : "";
	if (!kind) recommendations.push("Add an opportunity type");

	let nextAction = "Matching is active. No action is required yet.";
	if (opportunity.lifecycle === "draft") {
		nextAction = recommendations.length ? recommendations[0] : "Open this opportunity for matching";
	} else if (opportunity.lifecycle === "paused") {
		nextAction = "Resume or withdraw this opportunity";
	} else if (["withdrawn", "fulfilled", "expired"].includes(opportunity.lifecycle)) {
		nextAction = "No further action is available for this opportunity";
	} else {
		const candidate = matches.find((match) => match.lifecycle === "candidate");
		const qualified = matches.find(
			(match) => match.lifecycle === "qualified" && !match.introductionStatus,
		);
		const accepted = matches.find((match) => match.introductionStatus === "accepted");
		if (candidate) nextAction = "Review and qualify the strongest candidate match";
		else if (qualified) nextAction = "Preview and request an introduction";
		else if (accepted) nextAction = "Continue in the established relationship";
	}

	return {
		opportunity,
		isOwnerOrganization,
		privateBrief:
			secretRow && typeof secretRow.private_brief === "string" ? secretRow.private_brief : null,
		recommendations,
		nextAction,
		matches,
		timeline,
	};
}
