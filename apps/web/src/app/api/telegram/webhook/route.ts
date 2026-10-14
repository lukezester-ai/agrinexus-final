import { NextRequest, NextResponse } from "next/server";
import {
	getTelegramBotToken,
	parseLinkUserIdFromStart,
	type TelegramUpdate,
} from "@/lib/telegram-bot";
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
		await sendTelegramMessage(
			String(msg.chat.id),
			"✅ Linked to Universal Business Core. Agro briefing is archived outside core.",
		);
	}

	return NextResponse.json({ ok: true });
}
