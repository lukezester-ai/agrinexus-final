export type MatchCapabilities = {
	canQualify: boolean;
	canRequestIntroduction: boolean;
	canRespondIntroduction: boolean;
	canManageRelationship: boolean;
};

export const NO_MATCH_CAPABILITIES: MatchCapabilities = {
	canQualify: false,
	canRequestIntroduction: false,
	canRespondIntroduction: false,
	canManageRelationship: false,
};

type CapabilityRow = {
	match_id: string;
	can_qualify: boolean;
	can_request_introduction: boolean;
	can_respond_introduction: boolean;
	can_manage_relationship: boolean;
};

export function parseMatchCapabilities(rows: unknown): Record<string, MatchCapabilities> {
	if (!Array.isArray(rows)) return {};
	return Object.fromEntries(
		(rows as CapabilityRow[]).map((row) => [
			row.match_id,
			{
				canQualify: row.can_qualify === true,
				canRequestIntroduction: row.can_request_introduction === true,
				canRespondIntroduction: row.can_respond_introduction === true,
				canManageRelationship: row.can_manage_relationship === true,
			},
		]),
	);
}
