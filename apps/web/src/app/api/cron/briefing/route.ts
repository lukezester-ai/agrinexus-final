import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyBriefingsCron } from "@/lib/briefing-send";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET?.trim();
	const auth = req.headers.get("authorization");
	const querySecret = req.nextUrl.searchParams.get("secret");

	const authorized =
		cronSecret &&
		(auth === `Bearer ${cronSecret}` || querySecret === cronSecret);

	if (!authorized) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const result = await sendWeeklyBriefingsCron();
	return NextResponse.json(result);
}
