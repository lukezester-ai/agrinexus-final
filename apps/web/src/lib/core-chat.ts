import type { AppLocale } from "@/i18n/routing";
import { isMistralConfigured, mistralChat, mistralModel } from "@/lib/mistral";

export type CoreChatResult = {
	response: string;
	handledBy: string;
	lastRoute: string;
	error?: string;
	traceId?: string;
};

export async function runCoreChat(opts: {
	message: string;
	locale: AppLocale;
}): Promise<CoreChatResult> {
	if (!isMistralConfigured()) {
		return {
			response: "",
			handledBy: "core-llm",
			lastRoute: "unconfigured",
			error: "MISTRAL_API_KEY not set",
		};
	}

	const lang = opts.locale === "ar" ? "Arabic" : opts.locale === "bg" ? "Bulgarian" : "English";
	const result = await mistralChat({
		system: `You are the Core assistant. Reply in ${lang}. Be concise. Help with organization, membership, Business Intents, Radar, introductions, and relationships.`,
		user: opts.message,
		model: mistralModel("MISTRAL_CORE_MODEL"),
		maxTokens: 320,
		temperature: 0.3,
	});

	if (!result.text) {
		return {
			response: "",
			handledBy: "core-llm",
			lastRoute: "error",
			error: result.error || "empty_completion",
			traceId: result.traceId,
		};
	}

	return {
		response: result.text,
		handledBy: "core-llm",
		lastRoute: "generic",
		traceId: result.traceId,
	};
}
