export type BriefingPreferences = {
	enabled: boolean;
	telegram_chat_id?: string;
	telegram_username?: string;
	viber_user_id?: string;
	preferred_channel?: "telegram" | "viber";
	linked_at?: string;
};

export const BRIEFING_STORAGE_KEY = "agrinexus_briefing_prefs_v1";

export function parseBriefingPreferences(raw: unknown): BriefingPreferences {
	if (!raw || typeof raw !== "object") {
		return { enabled: false };
	}
	const o = raw as Record<string, unknown>;
	return {
		enabled: o.enabled === true,
		telegram_chat_id:
			typeof o.telegram_chat_id === "string" ? o.telegram_chat_id : undefined,
		telegram_username:
			typeof o.telegram_username === "string" ? o.telegram_username : undefined,
		viber_user_id: typeof o.viber_user_id === "string" ? o.viber_user_id : undefined,
		preferred_channel:
			o.preferred_channel === "telegram" || o.preferred_channel === "viber"
				? o.preferred_channel
				: undefined,
		linked_at: typeof o.linked_at === "string" ? o.linked_at : undefined,
	};
}

export function isTelegramLinked(prefs: BriefingPreferences): boolean {
	return Boolean(prefs.telegram_chat_id);
}
