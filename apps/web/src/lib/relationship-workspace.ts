import { createClient } from "@/lib/supabase-server";
import { NO_MATCH_CAPABILITIES, parseMatchCapabilities } from "@/lib/match-capabilities";

export type RelationshipWorkspaceEvent = {
	id: string;
	kind: string;
	createdAt: string;
};

export type RelationshipWorkspace = {
	id: string;
	status: string;
	kind: string;
	startedAt: string;
	lastInteractionAt: string;
	organizationAName: string;
	organizationBName: string;
	canManage: boolean;
	events: RelationshipWorkspaceEvent[];
};

type RelationshipRow = {
	id: string;
	organization_a: string;
	organization_b: string;
	origin_match_id: string;
	kind: string;
	status: string;
	started_at: string;
	last_interaction_at: string;
};

export async function loadRelationshipWorkspace(id: string): Promise<RelationshipWorkspace | null> {
	const supabase = createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data: relationshipRow, error } = await supabase
		.from("business_relationships")
		.select("id, organization_a, organization_b, origin_match_id, kind, status, started_at, last_interaction_at")
		.eq("id", id)
		.maybeSingle();
	if (error || !relationshipRow) return null;

	const relationship = relationshipRow as RelationshipRow;
	const [{ data: radarRow }, { data: eventRows }, { data: capabilityRows }] = await Promise.all([
		supabase
			.from("business_radar_items")
			.select("organization_a_name, organization_b_name")
			.eq("item_kind", "relationship")
			.eq("item_id", id)
			.maybeSingle(),
		supabase
			.from("business_relationship_events")
			.select("id, kind, created_at")
			.eq("relationship_id", id)
			.order("created_at", { ascending: false }),
		supabase.rpc("business_match_capabilities", { p_match_ids: [relationship.origin_match_id] }),
	]);
	const capabilities = parseMatchCapabilities(capabilityRows);
	const relationshipCapabilities = capabilities[relationship.origin_match_id] ?? NO_MATCH_CAPABILITIES;

	return {
		id: relationship.id,
		status: relationship.status,
		kind: relationship.kind,
		startedAt: relationship.started_at,
		lastInteractionAt: relationship.last_interaction_at,
		organizationAName:
			typeof radarRow?.organization_a_name === "string" ? radarRow.organization_a_name : "Organization A",
		organizationBName:
			typeof radarRow?.organization_b_name === "string" ? radarRow.organization_b_name : "Organization B",
		canManage: relationshipCapabilities.canManageRelationship,
		events: (eventRows ?? []).map((row) => ({
			id: String(row.id),
			kind: String(row.kind),
			createdAt: String(row.created_at),
		})),
	};
}
