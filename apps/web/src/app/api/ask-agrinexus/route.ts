import { NextRequest, NextResponse } from "next/server";
import { parseAppLocale } from "@/i18n/routing";
import { runCoreChat } from "@/lib/core-chat";

export const dynamic = "force-dynamic";

/** Legacy alias — same generic core chat as POST /api/chat. */
export async function POST(req: NextRequest) {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const message = typeof body.message === "string" ? body.message : "";
	const locale = parseAppLocale(body.locale);

	if (!message.trim()) {
		return NextResponse.json({ error: "Message is required" }, { status: 400 });
	}

	const result = await runCoreChat({ message, locale });

	return NextResponse.json({
		response: result.response,
		handledBy: result.handledBy,
		lastRoute: result.lastRoute,
		error: result.error,
		traceId: result.traceId,
	});
}
