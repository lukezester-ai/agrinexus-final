import type { AppLocale } from "@/i18n/routing";
import { AGN_POLICY } from "@/lib/agrinexus-policy";
import { fetchLiveDeskPayload } from "@/lib/market-live-desk";
import { isMistralConfigured, mistralChat, mistralModel } from "@/lib/mistral";

export type ChatRoute =
	| "MARKET_AGENT"
	| "WEATHER_AGENT"
	| "FIELD_AGENT"
	| "ACADEMY_AGENT"
	| "GENERAL_RESPONSE";

export function classifyChatRoute(message: string): ChatRoute {
	const u = message.toLowerCase();
	if (
		/пазар|цен|cbot|матиф|продаж|форуърд|hedge|basis|пшеница|царевица|market|price|wheat|corn|futures|sell|buy/.test(
			u,
		)
	) {
		return "MARKET_AGENT";
	}
	if (/време|дъжд|пръск|метео|weather|rain|irrigation|frost|град/.test(u)) {
		return "WEATHER_AGENT";
	}
	if (/ndvi|поле|satellite|сателит|болест|плевел|scout|дрон|field|disease|weed/.test(u)) {
		return "FIELD_AGENT";
	}
	if (/академ|курс|урок|learn|academy|course|lesson|обуч/.test(u)) {
		return "ACADEMY_AGENT";
	}
	return "GENERAL_RESPONSE";
}

async function marketSnapshotBlock(): Promise<string> {
	try {
		const desk = await fetchLiveDeskPayload();
		if (!desk.rows.length) {
			return "=== MARKET SNAPSHOT ===\nUnavailable.\n=== END ===";
		}
		const body = desk.rows
			.map((r) => `${r.sym} (${r.name}): ${r.priceStr}, session ${r.deltaStr}`)
			.join("\n");
		return `=== MARKET SNAPSHOT (delayed, not investment advice) ===\n${body}\n=== END ===`;
	} catch {
		return "=== MARKET SNAPSHOT ===\nUnavailable.\n=== END ===";
	}
}

function systemForRoute(route: ChatRoute, locale: AppLocale, snapshot: string): string {
	const lang = locale === "bg" ? "Bulgarian" : "English";
	const base = `${AGN_POLICY}\nReply in ${lang}. Be concise (3–6 sentences unless the user asks for detail).`;

	switch (route) {
		case "MARKET_AGENT":
			return `${base}

You are the AgriNexus Market Agent. Use ONLY numbers from the snapshot below. Disclaimer: delayed data, not investment advice.

${snapshot}`;
		case "WEATHER_AGENT":
			return `${base}

You are the AgriNexus Weather & Agronomy Agent. Do NOT invent specific mm/°C forecasts. Tell users to check local METEO and their agronomist before spray or irrigation decisions.`;
		case "FIELD_AGENT":
			return `${base}

You are the AgriNexus Field Monitoring Agent (satellite/NDVI/scouting). No definitive diagnosis from photos unless user attached them. Suggest verification steps.`;
		case "ACADEMY_AGENT":
			return `${base}

You are the AgriNexus Academy guide. Point to courses, lab exercises, and learning paths inside AgriNexus Academy.`;
		default:
			return `${base}

You are the AgriNexus assistant. Help with farm software, break-even, decision diary, community, and where to find features.`;
	}
}

export function routeLabel(route: ChatRoute, locale: AppLocale): string {
	const labels: Record<ChatRoute, { en: string; bg: string }> = {
		MARKET_AGENT: { en: "Market", bg: "Пазар" },
		WEATHER_AGENT: { en: "Weather", bg: "Метео" },
		FIELD_AGENT: { en: "Field", bg: "Поле" },
		ACADEMY_AGENT: { en: "Academy", bg: "Академия" },
		GENERAL_RESPONSE: { en: "Assistant", bg: "Асистент" },
	};
	return locale === "bg" ? labels[route].bg : labels[route].en;
}

export async function runAgrinexusChat(opts: {
	message: string;
	locale?: AppLocale;
	farmContext?: { name?: string; hectares?: number; crop?: string }[];
}): Promise<{
	response: string;
	handledBy: string;
	lastRoute: ChatRoute;
	error?: string;
	traceId?: string;
}> {
	const locale = opts.locale ?? "bg";
	const message = opts.message.trim();
	if (!message) {
		return {
			response: "",
			handledBy: "error",
			lastRoute: "GENERAL_RESPONSE",
			error: "Empty message",
		};
	}

	// 1. Try the new Python LangGraph Orchestrator Backend
	const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
	try {
		const res = await fetch(`${backendUrl}/api/orchestrator/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message, locale, farmContext: opts.farmContext }),
			// Short timeout so we quickly fallback if backend is offline
			signal: AbortSignal.timeout(15000) 
		});

		if (res.ok) {
			const data = await res.json();
			if (!data.error) {
				return {
					response: data.response,
					handledBy: data.handledBy || "Оркестратор",
					lastRoute: data.lastRoute || "GENERAL_RESPONSE",
					traceId: data.traceId,
				};
			}
		}
	} catch (e) {
		console.warn("[agrinexus-chat] Backend orchestrator unavailable, falling back to regex router", e);
	}

	// 2. Fallback to original Regex router and direct Mistral call
	if (!isMistralConfigured()) {
		const err =
			locale === "bg"
				? "Чатът изисква MISTRAL_API_KEY в Vercel (apps/web) или .env.local. Добави ключа и redeploy."
				: "Chat requires MISTRAL_API_KEY in Vercel (apps/web) or .env.local. Add the key and redeploy.";
		return {
			response: err,
			handledBy: "offline",
			lastRoute: "GENERAL_RESPONSE",
			error: "MISTRAL_API_KEY not set",
		};
	}

	const route = classifyChatRoute(message);
	const snapshot =
		route === "MARKET_AGENT" ? await marketSnapshotBlock() : "";

	let context = "";
	if (opts.farmContext?.length) {
		const fields = opts.farmContext
			.map((f) => `${f.hectares ?? "?"}ha ${f.crop ?? ""} (${f.name ?? ""})`)
			.join(", ");
		context = `\n\nUser fields: ${fields}`;
	}

	const system = systemForRoute(route, locale, snapshot);
	const user = message + context;

	const result = await mistralChat({
		system,
		user,
		model: mistralModel("MISTRAL_MESH_MODEL"),
		maxTokens: 520,
		temperature: 0.35,
	});

	const text =
		result.text ??
		(locale === "bg"
			? "Не получих отговор от Mistral. Опитай отново след малко."
			: "No response from Mistral. Try again shortly.");

	return {
		response: text,
		handledBy: routeLabel(route, locale),
		lastRoute: route,
		error: result.error,
		traceId: result.traceId,
	};
}
