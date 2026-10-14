import { NextResponse } from "next/server";
import {
	assertRadarE2ESecret,
	isRadarE2EEnabled,
	parseRadarE2ERole,
	runRadarDomainAction,
} from "@/lib/radar-e2e";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	if (!isRadarE2EEnabled()) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	const body = (await request.json().catch(() => null)) as {
		secret?: string;
		role?: string;
		fn?: string;
		args?: Record<string, unknown>;
	} | null;
	if (!body || !assertRadarE2ESecret(body.secret)) {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}
	const role = parseRadarE2ERole(body.role);
	if (!role || !body.fn) {
		return NextResponse.json({ error: "invalid role or fn" }, { status: 400 });
	}
	try {
		await runRadarDomainAction(role, body.fn, body.args ?? {});
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "action failed";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
