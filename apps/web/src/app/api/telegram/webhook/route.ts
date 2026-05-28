import { NextRequest, NextResponse } from "next/server";
import {
	getTelegramBotToken,
	parseLinkUserIdFromStart,
	type TelegramUpdate,
} from "@/lib/telegram-bot";
import { mergeBriefingPreferences } from "@/lib/briefing-send";
import { sendTelegramMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
	const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
	if (secret) {
		const header = req.headers.get("x-telegram-bot-api-secret-token");
		if (header !== secret) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	if (!getTelegramBotToken()) {
		return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
	}

	let update: TelegramUpdate;
	try {
		update = (await req.json()) as TelegramUpdate;
	} catch {
		return NextResponse.json({ ok: true });
	}

	const msg = update.message;
	if (!msg?.text || !msg.chat?.id) {
		return NextResponse.json({ ok: true });
	}

	const userId = parseLinkUserIdFromStart(msg.text.trim());
	if (userId) {
		const merged = await mergeBriefingPreferences(userId, {
			enabled: true,
			telegram_chat_id: String(msg.chat.id),
			telegram_username: msg.from?.username ?? msg.chat.username,
			preferred_channel: "telegram",
			linked_at: new Date().toISOString(),
		});

		const reply = merged.ok
			? "✅ AgriNexus briefing е свързан. Ще получаваш decision card (понеделник сутрин). Можеш да изключиш от Настройки в сайта."
			: "⚠ Връзката не успя. Провери дали профилът съществува в AgriNexus и опитай отново от Настройки.";

		await sendTelegramMessage(String(msg.chat.id), reply);
	}

	return NextResponse.json({ ok: true });
}
