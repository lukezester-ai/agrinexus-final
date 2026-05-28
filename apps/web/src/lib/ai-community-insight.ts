import type { AppLocale } from "@/i18n/routing";
import type { CommunityPost } from "@/lib/community";
import { fetchLiveDeskPayload } from "@/lib/market-live-desk";
import { cbotPriceStrToEurPerTonne } from "@/lib/break-even";
import { isMistralConfigured, mistralChat, mistralModel } from "@/lib/mistral";

const AGENTS = [
	{
		slug: "mkt",
		icon: "📈",
		name: { en: "Market Agent", bg: "Пазарен агент" },
		tag: "MARKET",
		focus: {
			en: "commodity prices, basis, forward windows, CBOT reference",
			bg: "стокови цени, basis, форуърд прозорци, CBOT референция",
		},
	},
	{
		slug: "sat",
		icon: "🛰️",
		name: { en: "Satellite Agent", bg: "Сателитен агент" },
		tag: "FIELD",
		focus: {
			en: "NDVI, field stress zones, scouting priorities",
			bg: "NDVI, stress зони, приоритет за скаут",
		},
	},
	{
		slug: "wtr",
		icon: "🌦️",
		name: { en: "Weather Agent", bg: "Метео агент" },
		tag: "FIELD",
		focus: {
			en: "spray windows, rain risk, local forecast checks",
			bg: "прозорци за пръскане, дъжд, локална METEO",
		},
	},
	{
		slug: "orc",
		icon: "⚙️",
		name: { en: "Orchestrator", bg: "Оркестратор" },
		tag: "QUESTION",
		focus: {
			en: "tie-break decisions, decision diary, what to review today",
			bg: "обобщение на сигналите, decision diary, какво да прегледаш днес",
		},
	},
] as const;

function stableId(slug: string, day: string): string {
	return `ai-seed-${slug}-${day}`;
}

function staticAgentContent(
	agent: (typeof AGENTS)[number],
	locale: AppLocale,
	wheat: { priceStr: string; deltaStr: string } | undefined,
	cbotEur: number | null,
): string {
	const isBg = locale === "bg";
	if (agent.slug === "mkt") {
		return isBg
			? wheat
				? `Пшеница (CBOT ref): ${wheat.priceStr} (${wheat.deltaStr}). Приблизително €${cbotEur ? Math.round(cbotEur) : "—"}/t. Прегледай местния basis и break-even преди форуърд — информация, не заповед.`
				: "Пазарното табло се зарежда. Добави местни купувачи в Настройки."
			: wheat
				? `Wheat (CBOT ref): ${wheat.priceStr} (${wheat.deltaStr}). Roughly €${cbotEur ? Math.round(cbotEur) : "—"}/t. Review local basis and break-even — informational only.`
				: "Market desk loading. Add local buyers in Settings.";
	}
	if (agent.slug === "sat") {
		return isBg
			? "NDVI: приоритизирай полета с пад >0.12 седмично. Дронов скаут само върху stress зони."
			: "NDVI: prioritize fields with >0.12 weekly drop. Drone scout stress zones only.";
	}
	if (agent.slug === "wtr") {
		return isBg
			? "Следващите 48ч: провери локална METEO преди пръскане. Не замества агроном при СЗР."
			: "Next 48h: check local METEO before spraying. Does not replace your agronomist on PPP.";
	}
	return isBg
		? "Няколко сигнала днес — отвори decision diary и запиши какво решаваш."
		: "Several signals today — open your decision diary and log what you choose.";
}

async function generateAgentPostMistral(
	agent: (typeof AGENTS)[number],
	locale: AppLocale,
	deskLine: string,
	fallback: string,
): Promise<string> {
	const lang = locale === "bg" ? "Bulgarian" : "English";
	const focus = locale === "bg" ? agent.focus.bg : agent.focus.en;

	const system = `You are the AgriNexus "${locale === "bg" ? agent.name.bg : agent.name.en}" posting one short message to the farmer AI Community feed.
Language: ${lang}. Length: 2–3 sentences, plain text only (no markdown, no hashtags).
Topic focus: ${focus}.
Rules: educational tone; not investment/trading advice; no invented prices; use desk figures only if provided; mention checking local buyers/agronomist when relevant.`;

	const user = `Write today's community post.\n\nDelayed desk snapshot:\n${deskLine || "(no desk data)"}`;

	const { text } = await mistralChat({
		system,
		user,
		model: mistralModel("MISTRAL_COMMUNITY_MODEL"),
		maxTokens: 180,
		temperature: 0.45,
	});

	if (!text || text.length < 20) return fallback;
	return text.replace(/\s+/g, " ").trim();
}

/** AI digest cards merged with Supabase farmer posts. Uses Mistral when MISTRAL_API_KEY is set. */
export async function buildAiCommunityDigest(locale: AppLocale): Promise<{
	posts: CommunityPost[];
	poweredByMistral: boolean;
}> {
	const desk = await fetchLiveDeskPayload();
	const wheat = desk.rows.find((r) => r.sym === "WHEAT");
	const day = new Date().toISOString().slice(0, 10);
	const isBg = locale === "bg";
	const cbotEur = wheat ? cbotPriceStrToEurPerTonne(wheat.priceStr) : null;
	const deskLine = desk.rows
		.map((r) => `${r.sym}: ${r.priceStr} (${r.deltaStr})`)
		.join("\n");

	const useMistral = isMistralConfigured();
	const now = new Date().toISOString();

	const contents = await Promise.all(
		AGENTS.map(async (agent) => {
			const fallback = staticAgentContent(agent, locale, wheat, cbotEur);
			if (!useMistral) return fallback;
			return generateAgentPostMistral(agent, locale, deskLine, fallback);
		}),
	);

	const posts: CommunityPost[] = AGENTS.map((agent, i) => ({
		id: stableId(agent.slug, day),
		user_id: null,
		author_name: isBg ? agent.name.bg : agent.name.en,
		location: "AI Mesh · Mistral",
		content: contents[i],
		tag: agent.tag,
		is_ai: true,
		ai_agent_slug: agent.slug,
		ai_agent_icon: agent.icon,
		likes_count: 12 + i * 3,
		comments_count: i,
		created_at: now,
	}));

	return { posts, poweredByMistral: useMistral };
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
	const desk = await fetchLiveDeskPayload();
	const deskLine = desk.rows
		.slice(0, 4)
		.map((r) => `${r.sym}: ${r.priceStr} (${r.deltaStr})`)
		.join("; ");

	const system = `You are an AgriNexus AI Community assistant (${lang}), powered by Mistral.
Write a helpful farmer-to-farmer style reply in 2–4 sentences.
Rules: educational tone; no guaranteed prices; not investment advice; encourage checking local buyers and agronomists; be practical.`;

	const user = `Community question/topic:\n${prompt.trim()}\n\nOptional desk context (delayed): ${deskLine}`;

	const result = await mistralChat({
		system,
		user,
		model: mistralModel("MISTRAL_COMMUNITY_MODEL"),
		maxTokens: 220,
		temperature: 0.4,
	});

	return { text: result.text, error: result.error };
}

export function templateCommunityInsight(locale: AppLocale, prompt: string): string {
	const isBg = locale === "bg";
	const snippet = prompt.trim().slice(0, 80);
	if (isBg) {
		return `Благодарим за темата: „${snippet}${prompt.length > 80 ? "…" : ""}“. Прегледай пазарното табло и местните купувачи в Настройки, сравни basis спрямо CBOT, и запиши решението в дневника. За AI отговори добави MISTRAL_API_KEY в Vercel (apps/web).`;
	}
	return `Thanks for raising: “${snippet}${prompt.length > 80 ? "…" : ""}”. Check the market desk and local buyers in Settings, compare basis vs CBOT, and log your decision in the diary. Add MISTRAL_API_KEY in Vercel (apps/web) for live AI replies.`;
}
