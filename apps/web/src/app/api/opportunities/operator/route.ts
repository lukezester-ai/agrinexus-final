import { NextRequest, NextResponse } from "next/server";
import { parseAppLocale } from "@/i18n/routing";
import { adviseBusinessOpportunity } from "@/lib/ai-business-operator";
import { isMistralConfigured } from "@/lib/mistral";
import { loadOpportunityWorkspace } from "@/lib/opportunity-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: "invalid_json" }, { status: 400 });
	}

	const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";
	const matchId = typeof body.matchId === "string" ? body.matchId.trim() : "";
	if (!UUID_PATTERN.test(opportunityId)) {
		return NextResponse.json({ error: "invalid_opportunity" }, { status: 400 });
	}
	if (matchId && !UUID_PATTERN.test(matchId)) {
		return NextResponse.json({ error: "invalid_match" }, { status: 400 });
	}

	const workspace = await loadOpportunityWorkspace(opportunityId);
	if (!workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });
	if (!workspace.isOwnerOrganization) return NextResponse.json({ error: "forbidden" }, { status: 403 });
	if (matchId) {
		const selectedMatch = workspace.matches.find((match) => match.id === matchId);
		if (!selectedMatch) return NextResponse.json({ error: "match_not_found" }, { status: 404 });
		if (selectedMatch.lifecycle !== "qualified" || selectedMatch.introductionStatus) {
			return NextResponse.json({ error: "match_not_available_for_introduction" }, { status: 409 });
		}
	}
	if (!isMistralConfigured()) {
		return NextResponse.json({ error: "business_operator_not_configured" }, { status: 503 });
	}

	const result = await adviseBusinessOpportunity({
		workspace,
		locale: parseAppLocale(body.locale),
		matchId: matchId || undefined,
	});
	if (!result.advice) {
		return NextResponse.json({ error: "business_operator_failed" }, { status: 502 });
	}
	return NextResponse.json({ advice: result.advice });
}
