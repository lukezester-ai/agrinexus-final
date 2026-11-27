// Supabase Edge Function: skill-draft
//
// Turns one plain-language description into a structured skill suggestion for the
// signed-in caller. The Mistral API key lives only in the function environment, so
// the static site in `skill-squad/` never holds a credential.
//
// Request:  POST { sourceText: string, locale?: "en" | "bg" | "ar" }
// Response: 200 { suggestion: { name, description, when_to_use, steps[], guardrails[] } }
//           400 { error: "invalid_request" | "source_too_long" }
//           401 { error: "authentication_required" }
//           503 { error: "ai_not_configured" }
//           502 { error: "empty_completion" | "invalid_structured_output" | "upstream_error" }
//
// The function never writes to the database: the browser saves the reviewed draft
// through public.create_organization_skill_v1().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SKILL_SOURCE_MAX_LENGTH = 4_000;
const SKILL_NAME_MAX_LENGTH = 120;
const SKILL_TEXT_MAX_LENGTH = 600;
const SKILL_MAX_STEPS = 8;
const SKILL_MAX_GUARDRAILS = 6;
const MISTRAL_TIMEOUT_MS = 30_000;

type SkillStep = { title: string; detail: string };

type SkillSuggestion = {
	name: string;
	description: string;
	when_to_use: string;
	steps: SkillStep[];
	guardrails: string[];
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
	});
}

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

/** Mirrors parseSkillSuggestion() in apps/web/src/lib/ai-skill-assist.ts. */
function parseSkillSuggestion(raw: string): SkillSuggestion | null {
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
		? Array.from(
				new Set(
					value.guardrails
						.filter((item): item is string => typeof item === "string")
						.map((item) => item.replace(/\s+/g, " ").trim())
						.filter((item) => item.length > 0 && item.length <= SKILL_TEXT_MAX_LENGTH),
				),
			).slice(0, SKILL_MAX_GUARDRAILS)
		: [];

	if (!name || !description || !whenToUse || steps.length === 0) return null;
	return { name, description, when_to_use: whenToUse, steps, guardrails };
}

function systemPrompt(language: string): string {
	return `You turn one organization's plain-language request into a reusable internal playbook. Return only one JSON object with exactly these keys: name, description, when_to_use, steps, guardrails.

- name: short, at most 120 characters.
- description: one or two sentences, at most 600 characters, stating what the playbook achieves.
- when_to_use: at most 600 characters, stating the trigger conditions.
- steps: array of 3 to ${SKILL_MAX_STEPS} objects with keys title and detail. Each title is a short imperative phrase; each detail is at most 600 characters and must be actionable on its own.
- guardrails: array of at most ${SKILL_MAX_GUARDRAILS} short strings the operator must respect.

Write name, description, when_to_use, steps, and guardrails in ${language}.
The playbook stays private to the requesting organization and is used by a human operator, not executed automatically.
Never invent prices, quantities, certifications, counterparties, deadlines, legal advice, or confidential facts. Never include credentials, API keys, tokens, passwords, or personal data. If the request is missing detail, keep the playbook conservative and generic rather than fabricating specifics. Do not add steps that would send messages, move money, or modify records without human approval.`;
}

function languageFor(locale: unknown): string {
	if (locale === "bg") return "Bulgarian";
	if (locale === "ar") return "Arabic";
	return "English";
}

async function requestMistral(sourceText: string, locale: unknown): Promise<string | null> {
	const apiKey = Deno.env.get("MISTRAL_API_KEY")?.trim();
	if (!apiKey) return null;

	const model = Deno.env.get("MISTRAL_SKILL_MODEL")?.trim() || "mistral-small-latest";
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), MISTRAL_TIMEOUT_MS);

	try {
		const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				temperature: 0.1,
				max_tokens: 1_200,
				response_format: { type: "json_object" },
				messages: [
					{ role: "system", content: systemPrompt(languageFor(locale)) },
					{ role: "user", content: sourceText },
				],
			}),
			signal: controller.signal,
		});

		if (!response.ok) {
			console.error("skill-draft: mistral responded", response.status);
			return null;
		}

		const payload = await response.json();
		const text = payload?.choices?.[0]?.message?.content;
		return typeof text === "string" && text.trim() ? text : "";
	} catch (error) {
		console.error("skill-draft: mistral request failed", error instanceof Error ? error.message : "unknown");
		return null;
	} finally {
		clearTimeout(timer);
	}
}

Deno.serve(async (request: Request) => {
	if (request.method === "OPTIONS") {
		return new Response("ok", { headers: CORS_HEADERS });
	}
	if (request.method !== "POST") {
		return json({ error: "method_not_allowed" }, 405);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
	if (!supabaseUrl || !supabaseAnonKey) {
		console.error("skill-draft: SUPABASE_URL or SUPABASE_ANON_KEY missing");
		return json({ error: "ai_not_configured" }, 503);
	}

	const authorization = request.headers.get("Authorization") || "";
	const token = authorization.replace(/^Bearer\s+/i, "").trim();
	if (!token) {
		return json({ error: "authentication_required" }, 401);
	}

	const supabase = createClient(supabaseUrl, supabaseAnonKey, {
		global: { headers: { Authorization: `Bearer ${token}` } },
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data: userData, error: userError } = await supabase.auth.getUser(token);
	if (userError || !userData?.user) {
		return json({ error: "authentication_required" }, 401);
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: "invalid_request" }, 400);
	}

	const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
	if (!sourceText) {
		return json({ error: "invalid_request" }, 400);
	}
	if (sourceText.length > SKILL_SOURCE_MAX_LENGTH) {
		return json({ error: "source_too_long" }, 400);
	}

	const completion = await requestMistral(sourceText, body.locale);
	if (completion === null) {
		return json({ error: Deno.env.get("MISTRAL_API_KEY") ? "upstream_error" : "ai_not_configured" }, 503);
	}
	if (!completion) {
		return json({ error: "empty_completion" }, 502);
	}

	const suggestion = parseSkillSuggestion(completion);
	if (!suggestion) {
		return json({ error: "invalid_structured_output" }, 502);
	}

	return json({ suggestion });
});
