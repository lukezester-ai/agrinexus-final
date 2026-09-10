import { NextRequest, NextResponse } from "next/server";
import { parseAppLocale } from "@/i18n/routing";
import { suggestBusinessIntent } from "@/lib/ai-intent-assist";
import { isMistralConfigured } from "@/lib/mistral";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	const supabase = createClient();
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await request.json() as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: "invalid_json" }, { status: 400 });
	}

	const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
	const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
		return NextResponse.json({ error: "invalid_organization" }, { status: 400 });
	}
	if (sourceText.length < 20 || sourceText.length > 4000) {
		return NextResponse.json({ error: "source_text_must_be_20_to_4000_characters" }, { status: 400 });
	}

	const { data: membership, error: membershipError } = await supabase
		.from("organization_memberships")
		.select("role")
		.eq("organization_id", organizationId)
		.eq("user_id", user.id)
		.maybeSingle();
	if (membershipError || !membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });
	if (!isMistralConfigured()) return NextResponse.json({ error: "intent_assistant_not_configured" }, { status: 503 });

	const result = await suggestBusinessIntent({ sourceText, locale: parseAppLocale(body.locale) });
	if (!result.suggestion) {
		return NextResponse.json({ error: "intent_assistant_failed" }, { status: 502 });
	}

	return NextResponse.json({ suggestion: result.suggestion });
}
