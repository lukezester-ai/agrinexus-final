import type { AppLocale } from "@/i18n/routing";
import {
	INDUSTRY_SUGGESTIONS,
	INTENT_KINDS,
	type IntentKind,
} from "@/lib/business-intents";
import { mistralChat, mistralModel } from "@/lib/mistral";

export type IntentSuggestion = {
	kind: IntentKind;
	headline: string;
	publicSummary: string;
	industry: string;
	targetMarkets: string[];
};

export type IntentAssistResult = {
	suggestion: IntentSuggestion | null;
	error?: string;
	traceId?: string;
};

const MARKET_PATTERN = /^[A-Z0-9][A-Z0-9 -]{0,31}$/;

function cleanText(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const clean = value.replace(/\s+/g, " ").trim();
	return clean && clean.length <= maxLength ? clean : null;
}

export function parseIntentSuggestion(raw: string): IntentSuggestion | null {
	let candidate: unknown;
	try {
		candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
	} catch {
		return null;
	}
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

	const value = candidate as Record<string, unknown>;
	const kind = typeof value.kind === "string" && (INTENT_KINDS as readonly string[]).includes(value.kind)
		? value.kind as IntentKind
		: null;
	const headline = cleanText(value.headline, 120);
	const publicSummary = cleanText(value.public_summary, 600);
	const industry = cleanText(value.industry, 80)?.toLowerCase() ?? null;
	const targetMarkets = Array.isArray(value.target_markets)
		? Array.from(new Set(value.target_markets
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.trim().toUpperCase())
			.filter((item) => MARKET_PATTERN.test(item))))
			.slice(0, 12)
		: [];

	if (!kind || !headline || !publicSummary || !industry) return null;
	return { kind, headline, publicSummary, industry, targetMarkets };
}

export async function suggestBusinessIntent(opts: {
	sourceText: string;
	locale: AppLocale;
}): Promise<IntentAssistResult> {
	const language = opts.locale === "bg" ? "Bulgarian" : opts.locale === "ar" ? "Arabic" : "English";
	const result = await mistralChat({
		system: `You structure a user's business need into a Universal Business Core intent. Return only one JSON object with exactly these keys: kind, headline, public_summary, industry, target_markets. kind must be one of: ${INTENT_KINDS.join(", ")}. target_markets must be an array of short uppercase ISO country codes or clear region names. Write headline and public_summary in ${language}. Never invent prices, quantities, certifications, counterparties, or confidential facts. public_summary must be safe to show to another business. If details are missing, keep the output conservative instead of fabricating them. Common industry values include: ${INDUSTRY_SUGGESTIONS.join(", ")}.`,
		user: opts.sourceText,
		model: mistralModel("MISTRAL_INTENT_MODEL", "mistral-small-latest"),
		temperature: 0.1,
		maxTokens: 420,
		timeoutMs: 20_000,
		jsonObject: true,
		telemetry: false,
	});

	if (!result.text) return { suggestion: null, error: result.error || "empty_completion", traceId: result.traceId };
	const suggestion = parseIntentSuggestion(result.text);
	return suggestion
		? { suggestion, traceId: result.traceId }
		: { suggestion: null, error: "invalid_structured_output", traceId: result.traceId };
}
