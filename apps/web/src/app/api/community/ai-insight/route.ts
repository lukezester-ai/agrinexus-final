import { NextRequest, NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/routing";
import {
	generateCommunityAiInsight,
	templateCommunityInsight,
} from "@/lib/ai-community-insight";
import { isMistralConfigured } from "@/lib/mistral";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({
		configured: isMistralConfigured(),
		model: process.env.MISTRAL_COMMUNITY_MODEL?.trim() || "mistral-small-latest",
	});
}

export async function POST(req: NextRequest) {
	let body: { prompt?: string; locale?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
	if (!prompt || prompt.length > 2000) {
		return NextResponse.json({ error: "Prompt required (max 2000 chars)" }, { status: 400 });
	}

	const locale: AppLocale = body.locale === "bg" ? "bg" : "en";

	if (!isMistralConfigured()) {
		return NextResponse.json(
			{
				text: templateCommunityInsight(locale, prompt),
				source: "template",
				mistral: false,
				hint: "Set MISTRAL_API_KEY on Vercel (Project → Settings → Environment Variables) for apps/web, then redeploy.",
			},
			{ status: 200 },
		);
	}

	const ai = await generateCommunityAiInsight(locale, prompt);
	const text = ai.text ?? templateCommunityInsight(locale, prompt);

	return NextResponse.json({
		text,
		source: ai.text ? "mistral" : "template",
		mistral: Boolean(ai.text),
		error: ai.error,
	});
}
