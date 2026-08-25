import type { AppLocale } from "@/i18n/routing";
import type { CommunityPost } from "@/lib/community";
import { isMistralConfigured, mistralChat, mistralModel } from "@/lib/mistral";

export function templateCommunityInsight(locale: AppLocale, prompt: string): string {
	const snippet = prompt.trim().slice(0, 80);
	if (locale === "bg") {
		return `Благодарим за темата: „${snippet}${prompt.length > 80 ? "…" : ""}“. Това е generic core assistant — без агро пазар и Academy.`;
	}
	return `Thanks for raising: “${snippet}${prompt.length > 80 ? "…" : ""}”. This is the generic core assistant — no agro market or Academy tools.`;
}

export async function generateCommunityAiInsight(
	locale: AppLocale,
	prompt: string,
): Promise<{ text: string | null; error?: string }> {
	if (!prompt.trim()) return { text: null, error: "empty prompt" };
	if (!isMistralConfigured()) {
		return { text: null, error: "MISTRAL_API_KEY not set" };
	}

	const lang = locale === "bg" ? "Bulgarian" : "English";
	const result = await mistralChat({
		system: `You are the Universal Business Core community assistant (${lang}). 2–4 sentences. No agriculture, commodity, or academy advice.`,
		user: prompt.trim(),
		model: mistralModel("MISTRAL_COMMUNITY_MODEL"),
		maxTokens: 220,
		temperature: 0.4,
	});

	return { text: result.text, error: result.error };
}

export async function buildAiCommunityDigest(locale: AppLocale): Promise<{
	posts: CommunityPost[];
	poweredByMistral: boolean;
}> {
	const now = new Date().toISOString();
	const isBg = locale === "bg";
	const posts: CommunityPost[] = [
		{
			id: `core-digest-${now.slice(0, 10)}`,
			user_id: null,
			author_name: "Core assistant",
			location: "Universal Business Core",
			content: isBg
				? "Ядрото е активно: организации, членства и generic chat. Агро сигналите не са част от core."
				: "Core is live: organizations, memberships, and generic chat. Agro signals are outside core.",
			tag: "QUESTION",
			is_ai: true,
			ai_agent_slug: "core",
			ai_agent_icon: "◆",
			likes_count: 0,
			comments_count: 0,
			created_at: now,
		},
	];
	return { posts, poweredByMistral: isMistralConfigured() };
}
