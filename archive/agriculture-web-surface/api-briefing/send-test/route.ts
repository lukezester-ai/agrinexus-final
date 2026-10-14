import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendBriefingToUser } from "@/lib/briefing-send";

export const dynamic = "force-dynamic";

export async function POST() {
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const result = await sendBriefingToUser(session.user.id, "bg");
	if (!result.ok) {
		return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 400 });
	}
	return NextResponse.json({ ok: true });
}
