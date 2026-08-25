import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function marketingOrigin(): string | null {
	const configured = process.env.AGN_MARKETING_ORIGIN?.trim();
	if (configured) return configured.replace(/\/$/, "");
	if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:3456";
	return null;
}

/** Прокси към реалния `POST /api/academy-tutor` (Mistral + пазарен snapshot за обучение). */
export async function POST(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Невалиден JSON." }, { status: 400 });
	}

	const b = body as { message?: string };
	if (typeof b.message !== "string" || !b.message.trim()) {
		return NextResponse.json({ error: "message е задължително." }, { status: 400 });
	}

	const origin = marketingOrigin();
	if (!origin) {
		return NextResponse.json(
			{ error: "AGN_MARKETING_ORIGIN must be configured for the Academy Tutor server in production." },
			{ status: 503 },
		);
	}

	try {
		const res = await fetch(`${origin}/api/academy-tutor`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: b.message.trim() }),
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
					"Няма връзка с Academy Tutor. Пусни в корена: npm run dev (3456) и MISTRAL_API_KEY в .env там.",
			},
			{ status: 503 },
		);
	}
}
