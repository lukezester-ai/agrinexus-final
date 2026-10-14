import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret) return false;
	return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const supabase = createAdminClient();
	if (!supabase) {
		return NextResponse.json({ error: "matcher service is not configured" }, { status: 503 });
	}

	const { data, error } = await supabase.rpc("run_matching_engine_v1");
	if (error) {
		console.error("Matching Engine v1 run failed", {
			code: error.code,
			message: error.message,
		});
		return NextResponse.json({ error: "matching run failed" }, { status: 500 });
	}

	return NextResponse.json({ ok: true, matchesWritten: Number(data ?? 0) });
}
