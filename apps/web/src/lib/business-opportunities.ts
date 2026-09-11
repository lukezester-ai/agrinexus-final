export const OPPORTUNITY_KINDS = [
	"buy",
	"sell",
	"partner",
	"invest",
	"supply",
	"distribute",
	"hire",
	"seek_capability",
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPPORTUNITY_VISIBILITIES = ["private", "confidential", "network", "public"] as const;
export type OpportunityVisibility = (typeof OPPORTUNITY_VISIBILITIES)[number];

export type BusinessOpportunity = {
	id: string;
	organization_id: string | null;
	created_by: string | null;
	source_type: string;
	title: string;
	summary: string;
	industry: string;
	target_markets: string[];
	visibility: OpportunityVisibility;
	lifecycle: string;
	facets: Record<string, unknown>;
	created_at: string;
	updated_at: string;
};

export type OpportunityWorkspaceMatch = {
	id: string;
	lifecycle: string;
	score: number;
	confidence: number;
	reasons: Array<{ code: string; ok?: boolean; value?: number }>;
	introductionStatus: string | null;
	relationshipId: string | null;
	relationshipStatus: string | null;
};

export type OpportunityWorkspaceEvent = {
	id: string;
	kind: string;
	createdAt: string;
	detail: string | null;
};

export type OpportunityWorkspace = {
	opportunity: BusinessOpportunity;
	isOwnerOrganization: boolean;
	privateBrief: string | null;
	recommendations: string[];
	nextAction: string;
	matches: OpportunityWorkspaceMatch[];
	timeline: OpportunityWorkspaceEvent[];
};
