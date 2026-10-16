/**
 * Organization Skills — org-scoped AI playbooks authored from free text.
 *
 * A skill belongs to exactly one organization. It is not a Business Intent, has no
 * visibility token, is never indexed for matching, and is never readable by another
 * organization.
 */

export const SKILL_STATUSES = ["draft", "active", "archived"] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** One playbook step. Stored as jsonb, so it is validated on read as well as on write. */
export type SkillStep = {
	title: string;
	detail: string;
};

export type OrganizationSkill = {
	id: string;
	organization_id: string;
	created_by: string;
	name: string;
	description: string;
	when_to_use: string;
	steps: SkillStep[];
	guardrails: string[];
	status: SkillStatus;
	source_text: string;
	created_at: string;
	updated_at: string;
};

export const SKILL_SOURCE_MIN_LENGTH = 20;
export const SKILL_SOURCE_MAX_LENGTH = 4000;
export const SKILL_NAME_MAX_LENGTH = 120;
export const SKILL_TEXT_MAX_LENGTH = 600;
export const SKILL_MAX_STEPS = 8;
export const SKILL_MAX_GUARDRAILS = 6;

export const SKILL_SELECT_COLUMNS =
	"id, organization_id, created_by, name, description, when_to_use, steps, guardrails, status, source_text, created_at, updated_at";

/**
 * jsonb is untyped at the storage boundary. Normalise it before rendering so a
 * hand-edited row cannot break the dashboard.
 */
export function normalizeSteps(value: unknown): SkillStep[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
		.map((entry) => ({
			title: typeof entry.title === "string" ? entry.title : "",
			detail: typeof entry.detail === "string" ? entry.detail : "",
		}))
		.filter((step) => step.title || step.detail)
		.slice(0, SKILL_MAX_STEPS);
}

export function normalizeGuardrails(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.slice(0, SKILL_MAX_GUARDRAILS);
}

/** Accepts the raw PostgREST row and returns a render-safe skill. */
export function normalizeSkill(row: Record<string, unknown>): OrganizationSkill {
	return {
		id: String(row.id ?? ""),
		organization_id: String(row.organization_id ?? ""),
		created_by: String(row.created_by ?? ""),
		name: String(row.name ?? ""),
		description: typeof row.description === "string" ? row.description : "",
		when_to_use: typeof row.when_to_use === "string" ? row.when_to_use : "",
		steps: normalizeSteps(row.steps),
		guardrails: normalizeGuardrails(row.guardrails),
		status: (SKILL_STATUSES as readonly string[]).includes(String(row.status))
			? (row.status as SkillStatus)
			: "draft",
		source_text: typeof row.source_text === "string" ? row.source_text : "",
		created_at: String(row.created_at ?? ""),
		updated_at: String(row.updated_at ?? ""),
	};
}
