import type { AppLocale } from "@/i18n/routing";
import type { OpportunityWorkspace } from "@/lib/business-opportunities";
import { positiveReasonCodes } from "@/lib/business-radar";
import { mistralChat, mistralModel } from "@/lib/mistral";

export type BusinessOperatorAdvice = {
	assessment: string;
	missingData: string[];
	matchInsights: string[];
	risks: string[];
	nextActions: string[];
	introductionDraft: string | null;
};

export type BusinessOperatorResult = {
	advice: BusinessOperatorAdvice | null;
	error?: string;
	traceId?: string;
};

function cleanText(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const clean = value.replace(/\s+/g, " ").trim();
	return clean && clean.length <= maxLength ? clean : null;
}

function cleanList(value: unknown, maxItems: number, maxLength: number): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => cleanText(item, maxLength))
		.filter((item): item is string => Boolean(item))
		.slice(0, maxItems);
}

export function parseBusinessOperatorAdvice(raw: string): BusinessOperatorAdvice | null {
	let candidate: unknown;
	try {
		candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
	} catch {
		return null;
	}
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
	const value = candidate as Record<string, unknown>;
	const assessment = cleanText(value.assessment, 600);
	if (!assessment) return null;
	return {
		assessment,
		missingData: cleanList(value.missing_data, 5, 180),
		matchInsights: cleanList(value.match_insights, 5, 220),
		risks: cleanList(value.risks, 5, 220),
		nextActions: cleanList(value.next_actions, 4, 180),
		introductionDraft: cleanText(value.introduction_draft, 900),
	};
}

export async function adviseBusinessOpportunity(opts: {
	workspace: OpportunityWorkspace;
	locale: AppLocale;
}): Promise<BusinessOperatorResult> {
	const { opportunity, matches } = opts.workspace;
	const language = opts.locale === "bg" ? "Bulgarian" : opts.locale === "ar" ? "Arabic" : "English";
	const safeContext = {
		opportunity: {
			kind: typeof opportunity.facets?.kind === "string" ? opportunity.facets.kind : null,
			title: opportunity.title,
			summary: opportunity.summary,
			industry: opportunity.industry,
			target_markets: opportunity.target_markets,
			visibility: opportunity.visibility,
			lifecycle: opportunity.lifecycle,
		},
		matches: matches.slice(0, 5).map((match) => ({
			lifecycle: match.lifecycle,
			score: match.score,
			confidence: match.confidence,
			positive_reason_codes: positiveReasonCodes(match.reasons),
			introduction_status: match.introductionStatus,
			relationship_status: match.relationshipStatus,
		})),
		deterministic_missing_data: opts.workspace.recommendations,
		deterministic_next_action: opts.workspace.nextAction,
	};

	const result = await mistralChat({
		system: `You are the AI Business Operator inside Universal Business Core. Analyze one concrete business opportunity and its authorized, public-safe match signals. Write in ${language}. Return only one JSON object with exactly these keys: assessment, missing_data, match_insights, risks, next_actions, introduction_draft. assessment is a concise explanation. The four list fields contain short strings. introduction_draft is either a professional draft message or null. Never invent prices, quantities, certifications, company identities, legal claims, probabilities, or facts not present in the input. A match score is criteria alignment, not deal probability. Do not claim that you executed an action. Do not instruct the user to bypass authorization, lifecycle, audit, trust, or introduction controls. If there is no qualified match, introduction_draft must be null. Prefer specific, economically useful recommendations over generic advice.`,
		user: JSON.stringify(safeContext),
		model: mistralModel("MISTRAL_BUSINESS_OPERATOR_MODEL", "mistral-small-latest"),
		temperature: 0.1,
		maxTokens: 900,
		timeoutMs: 25_000,
		jsonObject: true,
		telemetry: false,
	});

	if (!result.text) return { advice: null, error: result.error || "empty_completion", traceId: result.traceId };
	const advice = parseBusinessOperatorAdvice(result.text);
	return advice
		? { advice, traceId: result.traceId }
		: { advice: null, error: "invalid_structured_output", traceId: result.traceId };
}
