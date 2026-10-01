import { NextResponse } from "next/server";
import { FinanceAllowlistError, LIVE_EXECUTION, prepareFinanceCall } from "@/lib/finance-allowlist";
import { FinanceDatabaseError, runFinanceCall } from "@/lib/finance-db";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized", live_execution: LIVE_EXECUTION }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "field is not allowed", live_execution: LIVE_EXECUTION }, { status: 400 });
	}
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		return NextResponse.json({ error: "field is not allowed", live_execution: LIVE_EXECUTION }, { status: 400 });
	}
	const record = body as Record<string, unknown>;
	if (typeof record.operation !== "string") {
		return NextResponse.json({ error: "operation is not allowed", live_execution: LIVE_EXECUTION }, { status: 400 });
	}

	try {
		const call = prepareFinanceCall(record.operation, record.input ?? {});
		const rows = await runFinanceCall(session.user.id, call);
		return NextResponse.json({ live_execution: LIVE_EXECUTION, rows });
	} catch (error) {
		if (error instanceof FinanceAllowlistError) {
			return NextResponse.json({ error: error.message, live_execution: LIVE_EXECUTION }, { status: 400 });
		}
		if (error instanceof FinanceDatabaseError && error.message === "finance database is not configured") {
			return NextResponse.json({ error: error.message, live_execution: LIVE_EXECUTION }, { status: 503 });
		}
		const message = error instanceof Error ? error.message : "finance call failed";
		return NextResponse.json({ error: message, live_execution: LIVE_EXECUTION }, { status: 400 });
	}
}
