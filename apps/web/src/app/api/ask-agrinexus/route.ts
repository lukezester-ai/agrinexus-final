import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Кореновият `npm run dev` (scripts/dev-server.mjs) — там е `/api/chat` (Mistral + маршрутизатор). */
function marketingOrigin(): string {
	return (process.env.AGN_MARKETING_ORIGIN ?? "http://127.0.0.1:3456").replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Невалиден JSON." }, { status: 400 });
	}

	const origin = marketingOrigin();
	try {
		const res = await fetch(`${origin}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			cache: "no-store",
			signal: AbortSignal.timeout(120_000),
		});
		const text = await res.text();
		let data: unknown;
		try {
			data = JSON.parse(text) as unknown;
		} catch {
			data = { error: text.slice(0, 500) };
		}
		return NextResponse.json(data, { status: res.status });
	} catch {
		return NextResponse.json(
			{
				error:
					"Не стигаме до AI сървъра. В отделен терминал, от корена на репото: npm run dev (порт 3456). Трябва и MISTRAL_API_KEY в .env там.",
			},
			{ status: 503 },
		);
	}
}
