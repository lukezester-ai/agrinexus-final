import { NextRequest, NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/routing";
import { runAgrinexusChat } from "@/lib/agrinexus-chat";
import { isMistralConfigured } from "@/lib/mistral";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ configured: isMistralConfigured() });
}

export async function POST(req: NextRequest) {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const message = typeof body.message === "string" ? body.message : "";
	const locale: AppLocale = body.locale === "en" ? "en" : "bg";
	const farmContext = Array.isArray(body.farmContext)
		? (body.farmContext as { name?: string; hectares?: number; crop?: string }[])
		: undefined;

	if (!message.trim()) {
		return NextResponse.json({ error: "Message is required" }, { status: 400 });
	}

	const result = await runAgrinexusChat({ message, locale, farmContext });

	return NextResponse.json({
		response: result.response,
		handledBy: result.handledBy,
		lastRoute: result.lastRoute,
		error: result.error,
		traceId: result.traceId,
	});
}
