import type { AppLocale } from "@/i18n/routing";
import { parseBriefingPreferences, type BriefingPreferences } from "@/lib/briefing-preferences";
import { parseBreakEvenInputs } from "@/lib/break-even";
import { fetchLiveDeskPayload } from "@/lib/market-live-desk";
import { formatBriefingPlain, buildWeeklyBriefingCard } from "@/lib/weekly-briefing";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import { createAdminClient } from "@/lib/supabase-admin";

function siteUrl(): string {
	if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
		return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
	}
	if (process.env.VERCEL_URL?.trim()) {
		return `https://${process.env.VERCEL_URL}`;
	}
	return "https://agrinexus-final-real.vercel.app";
}

export async function buildBriefingForUser(
	userId: string,
	locale: AppLocale = "bg",
): Promise<{ card: ReturnType<typeof buildWeeklyBriefingCard>; text: string } | null> {
	const admin = createAdminClient();
	if (!admin) return null;

	const { data: profile } = await admin
		.from("farm_profiles")
		.select("break_even_inputs, total_ha, region")
		.eq("user_id", userId)
		.single();

	if (!profile) return null;

	const desk = await fetchLiveDeskPayload();
	const wheat = desk.rows.find((r) => r.sym === "WHEAT");
	const breakEven = parseBreakEvenInputs(profile.break_even_inputs);
	const totalHa = Number(profile.total_ha) || 0;

	const card = buildWeeklyBriefingCard({
		locale,
		desk,
		wheat,
		breakEven,
		totalHa,
		siteUrl: siteUrl(),
	});

	return { card, text: formatBriefingPlain(card) };
}

export async function sendBriefingToUser(
	userId: string,
	locale: AppLocale = "bg",
): Promise<{ ok: boolean; error?: string }> {
	const admin = createAdminClient();
	if (!admin) {
		return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" };
	}

	const { data: profile } = await admin
		.from("farm_profiles")
		.select("briefing_preferences")
		.eq("user_id", userId)
		.single();

	const prefs = parseBriefingPreferences(profile?.briefing_preferences);
	if (!prefs.enabled || !prefs.telegram_chat_id) {
		return { ok: false, error: "Telegram not linked or briefing disabled" };
	}

	const built = await buildBriefingForUser(userId, locale);
	if (!built) return { ok: false, error: "Could not build briefing" };

	const sent = await sendTelegramMessage(prefs.telegram_chat_id, built.text);
	return sent ? { ok: true } : { ok: false, error: "Telegram send failed" };
}

export async function sendWeeklyBriefingsCron(): Promise<{
	sent: number;
	skipped: number;
	errors: string[];
}> {
	const admin = createAdminClient();
	const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
	if (!admin || !token) {
		return { sent: 0, skipped: 0, errors: ["Missing SUPABASE_SERVICE_ROLE_KEY or TELEGRAM_BOT_TOKEN"] };
	}

	const { data: rows, error } = await admin
		.from("farm_profiles")
		.select("user_id, briefing_preferences, region")
		.not("briefing_preferences", "is", null);

	if (error) {
		return { sent: 0, skipped: 0, errors: [error.message] };
	}

	let sent = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (const row of rows ?? []) {
		const prefs = parseBriefingPreferences(row.briefing_preferences);
		if (!prefs.enabled || !prefs.telegram_chat_id) {
			skipped++;
			continue;
		}
		const locale: AppLocale =
			typeof row.region === "string" && row.region.toLowerCase().includes("север")
				? "bg"
				: "bg";

		const built = await buildBriefingForUser(row.user_id, locale);
		if (!built) {
			skipped++;
			continue;
		}
		const ok = await sendTelegramMessage(prefs.telegram_chat_id, built.text);
		if (ok) sent++;
		else errors.push(`send failed for ${row.user_id}`);
	}

	return { sent, skipped, errors };
}

export async function mergeBriefingPreferences(
	userId: string,
	patch: Partial<BriefingPreferences>,
): Promise<{ ok: boolean; error?: string }> {
	const admin = createAdminClient();
	if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" };

	const { data: row } = await admin
		.from("farm_profiles")
		.select("briefing_preferences")
		.eq("user_id", userId)
		.single();

	const current = parseBriefingPreferences(row?.briefing_preferences);
	const next: BriefingPreferences = { ...current, ...patch };

	const { error } = await admin
		.from("farm_profiles")
		.update({ briefing_preferences: next })
		.eq("user_id", userId);

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}
