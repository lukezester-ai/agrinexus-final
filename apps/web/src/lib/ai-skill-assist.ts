import type { AppLocale } from "@/i18n/routing";
import { mistralChat, mistralModel } from "@/lib/mistral";
import {
	SKILL_MAX_GUARDRAILS,
	SKILL_MAX_STEPS,
	SKILL_NAME_MAX_LENGTH,
	SKILL_TEXT_MAX_LENGTH,
	type SkillStep,
} from "@/lib/skills";

export type SkillSuggestion = {
	name: string;
	description: string;
	whenToUse: string;
	steps: SkillStep[];
	guardrails: string[];
};

export type SkillAssistResult = {
	suggestion: SkillSuggestion | null;
	error?: string;
	traceId?: string;
};

function cleanText(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const clean = value.replace(/\s+/g, " ").trim();
	return clean && clean.length <= maxLength ? clean : null;
}

function parseSteps(value: unknown): SkillStep[] {
	if (!Array.isArray(value)) return [];
	return value
		.slice(0, SKILL_MAX_STEPS)
		.map((entry) => {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
			const step = entry as Record<string, unknown>;
			const title = cleanText(step.title, SKILL_NAME_MAX_LENGTH);
			const detail = cleanText(step.detail, SKILL_TEXT_MAX_LENGTH);
			return title && detail ? { title, detail } : null;
		})
		.filter((step): step is SkillStep => step !== null);
}

export function parseSkillSuggestion(raw: string): SkillSuggestion | null {
	let candidate: unknown;
	try {
		candidate = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
	} catch {
		return null;
	}
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

	const value = candidate as Record<string, unknown>;
	const name = cleanText(value.name, SKILL_NAME_MAX_LENGTH);
	const description = cleanText(value.description, SKILL_TEXT_MAX_LENGTH);
	const whenToUse = cleanText(value.when_to_use, SKILL_TEXT_MAX_LENGTH);
	const steps = parseSteps(value.steps);
	const guardrails = Array.isArray(value.guardrails)
		? Array.from(new Set(value.guardrails
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.replace(/\s+/g, " ").trim())
			.filter((item) => item.length > 0 && item.length <= SKILL_TEXT_MAX_LENGTH)))
			.slice(0, SKILL_MAX_GUARDRAILS)
		: [];

	if (!name || !description || !whenToUse || steps.length === 0) return null;
	return { name, description, whenToUse, steps, guardrails };
}

export async function suggestOrganizationSkill(opts: {
	sourceText: string;
	locale: AppLocale;
}): Promise<SkillAssistResult> {
	const language = opts.locale === "bg" ? "Bulgarian" : opts.locale === "ar" ? "Arabic" : "English";
	const result = await mistralChat({
		system: `You turn one organization's plain-language request into a reusable internal playbook. Return only one JSON object with exactly these keys: name, description, when_to_use, steps, guardrails.

- name: short, at most 120 characters.
- description: one or two sentences, at most 600 characters, stating what the playbook achieves.
- when_to_use: at most 600 characters, stating the trigger conditions.
- steps: array of 3 to ${SKILL_MAX_STEPS} objects with keys title and detail. Each title is a short imperative phrase; each detail is at most 600 characters and must be actionable on its own.
- guardrails: array of at most ${SKILL_MAX_GUARDRAILS} short strings the operator must respect.

Write name, description, when_to_use, steps, and guardrails in ${language}.
The playbook stays private to the requesting organization and is used by a human operator, not executed automatically.
Never invent prices, quantities, certifications, counterparties, deadlines, legal advice, or confidential facts. Never include credentials, API keys, tokens, passwords, or personal data. If the request is missing detail, keep the playbook conservative and generic rather than fabricating specifics. Do not add steps that would send messages, move money, or modify records without human approval.`,
		user: opts.sourceText,
		model: mistralModel("MISTRAL_SKILL_MODEL", "mistral-small-latest"),
		temperature: 0.1,
		maxTokens: 1_200,
		timeoutMs: 30_000,
		jsonObject: true,
		telemetry: false,
	});

	if (!result.text) return { suggestion: null, error: result.error || "empty_completion", traceId: result.traceId };
	const suggestion = parseSkillSuggestion(result.text);
	return suggestion
		? { suggestion, traceId: result.traceId }
		: { suggestion: null, error: "invalid_structured_output", traceId: result.traceId };
}
