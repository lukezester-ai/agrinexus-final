const TELEGRAM_API = "https://api.telegram.org";

export function getTelegramBotToken(): string | null {
	return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function getTelegramBotUsername(): string | null {
	return (
		process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() ||
		process.env.TELEGRAM_BOT_USERNAME?.trim() ||
		null
	);
}

export function buildTelegramDeepLink(userId: string): string | null {
	const username = getTelegramBotUsername();
	if (!username) return null;
	return `https://t.me/${username}?start=link_${userId}`;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
	const token = getTelegramBotToken();
	if (!token) return false;
	const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			disable_web_page_preview: false,
		}),
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.warn("[telegram] sendMessage", res.status, body.slice(0, 200));
		return false;
	}
	return true;
}

export type TelegramUpdate = {
	message?: {
		message_id: number;
		chat: { id: number; username?: string };
		text?: string;
		from?: { username?: string };
	};
};

export function parseLinkUserIdFromStart(text: string | undefined): string | null {
	if (!text) return null;
	const m = text.match(/^\/start\s+link_([0-9a-f-]{36})$/i);
	return m ? m[1] : null;
}
