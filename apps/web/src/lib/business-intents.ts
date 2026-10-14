export const INTENT_KINDS = [
	"buy",
	"sell",
	"partner",
	"invest",
	"supply",
	"distribute",
	"hire",
	"seek_capability",
] as const;

export type IntentKind = (typeof INTENT_KINDS)[number];

export const INTENT_VISIBILITIES = ["private", "confidential", "network", "public"] as const;
export type IntentVisibility = (typeof INTENT_VISIBILITIES)[number];

export const INTENT_LIFECYCLES = [
	"draft",
	"active",
	"paused",
	"matched",
	"introducing",
	"fulfilled",
	"expired",
	"withdrawn",
] as const;
export type IntentLifecycle = (typeof INTENT_LIFECYCLES)[number];

export type BusinessIntent = {
	id: string;
	organization_id: string;
	created_by: string;
	kind: IntentKind;
	headline: string;
	public_summary: string;
	industry: string;
	target_markets: string[];
	visibility: IntentVisibility;
	lifecycle: IntentLifecycle;
	expires_at: string | null;
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

export const INDUSTRY_SUGGESTIONS = [
	"agri-food",
	"manufacturing",
	"logistics",
	"energy",
	"construction",
	"wholesale",
	"technology",
	"professional-services",
	"healthcare",
	"finance",
] as const;

export function parseMarketList(raw: string): string[] {
	return Array.from(
		new Set(
			raw
				.split(/[,;\n]/)
				.map((part) => part.trim().toUpperCase())
				.filter(Boolean),
		),
	);
}
