import { NextResponse } from "next/server";
import { cbotPriceStrToEurPerTonne } from "@/lib/break-even";
import { fetchLiveDeskPayload } from "@/lib/market-live-desk";

export const dynamic = "force-dynamic";

export async function GET() {
	const desk = await fetchLiveDeskPayload();
	const wheat = desk.rows.find((r) => r.sym === "WHEAT");
	const cbotEurPerTonne = wheat ? cbotPriceStrToEurPerTonne(wheat.priceStr) : null;

	return NextResponse.json({
		cbotEurPerTonne,
		priceStr: wheat?.priceStr ?? null,
		updatedAt: desk.updatedAt,
	});
}
