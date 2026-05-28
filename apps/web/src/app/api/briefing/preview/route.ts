import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseBreakEvenInputs } from "@/lib/break-even";
import { fetchLiveDeskPayload } from "@/lib/market-live-desk";
import { buildWeeklyBriefingCard } from "@/lib/weekly-briefing";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

function siteUrl(): string {
	if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
		return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
	}
	if (process.env.VERCEL_URL?.trim()) {
		return `https://${process.env.VERCEL_URL}`;
	}
	return "https://agrinexus-final-real.vercel.app";
}

export async function GET() {
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { data: profile } = await supabase
		.from("farm_profiles")
		.select("break_even_inputs, total_ha")
		.eq("user_id", session.user.id)
		.single();

	const desk = await fetchLiveDeskPayload();
	const wheat = desk.rows.find((r) => r.sym === "WHEAT");
	const locale: AppLocale = "bg";
	const card = buildWeeklyBriefingCard({
		locale,
		desk,
		wheat,
		breakEven: parseBreakEvenInputs(profile?.break_even_inputs),
		totalHa: Number(profile?.total_ha) || 0,
		siteUrl: siteUrl(),
	});

	return NextResponse.json({ card });
}
