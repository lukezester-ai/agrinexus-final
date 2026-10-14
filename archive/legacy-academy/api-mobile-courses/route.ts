import { NextRequest, NextResponse } from "next/server";
import { getMobileAcademyCatalog } from "@/lib/mobile-academy-catalog";

function backendBase(): string {
	const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
	return raw.replace(/\/$/, "");
}

async function verifyBearer(token: string): Promise<{ ok: true; email?: string } | { ok: false }> {
	const base = backendBase();
	try {
		const r = await fetch(`${base}/auth/me`, {
			method: "GET",
			headers: { Authorization: `Bearer ${token}` },
			cache: "no-store",
		});
		if (!r.ok) {
			return { ok: false };
		}
		const data = (await r.json()) as { email?: string };
		return { ok: true, email: data.email };
	} catch {
		return { ok: false };
	}
}

/**
 * Mobile catalog: same source as Academy hub (`coursesForLocale`).
 * If `Authorization: Bearer` is sent, the token is verified against `apps/backend` (`GET /auth/me`).
 * Anonymous requests still receive the catalog (read-only public listing).
 */
export async function GET(req: NextRequest) {
	const auth = req.headers.get("authorization");
	const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

	let authEmail: string | undefined;
	if (token) {
		const v = await verifyBearer(token);
		if (!v.ok) {
			return NextResponse.json({ error: "invalid_token" }, { status: 401 });
		}
		authEmail = v.email;
	}

	try {
		const courses = getMobileAcademyCatalog();
		const res = NextResponse.json({ courses });
		if (authEmail) {
			res.headers.set("X-Auth-Email", authEmail);
		}
		return res;
	} catch (e) {
		const message = e instanceof Error ? e.message : "catalog_error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
