import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** ElevenLabs single-request limit — stay under documented caps for multilingual TTS. */
const MAX_CHARS = 4500;

const DEFAULT_MODEL = "eleven_multilingual_v2";

function elevenConfigured(): boolean {
	const key = process.env.ELEVENLABS_API_KEY?.trim();
	const voice = process.env.ELEVENLABS_VOICE_ID?.trim();
	return Boolean(key && voice);
}

/** Client checks whether the ElevenLabs path is available (no secrets exposed). */
export async function GET() {
	return NextResponse.json({ configured: elevenConfigured() });
}

export async function POST(req: NextRequest) {
	if (!elevenConfigured()) {
		return NextResponse.json(
			{ error: "ElevenLabs не е конфигуриран. Задай ELEVENLABS_API_KEY и ELEVENLABS_VOICE_ID в .env.local." },
			{ status: 503 },
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Невалиден JSON." }, { status: 400 });
	}

	const b = body as { text?: string };
	if (typeof b.text !== "string" || !b.text.trim()) {
		return NextResponse.json({ error: "text е задължително." }, { status: 400 });
	}

	const text = b.text.trim();
	if (text.length > MAX_CHARS) {
		return NextResponse.json(
			{ error: `Текстът е твърде дълъг за една заявка (макс. ${MAX_CHARS} знака). Съкратете лекцията или четете на части.` },
			{ status: 400 },
		);
	}

	const apiKey = process.env.ELEVENLABS_API_KEY!.trim();
	const voiceId = process.env.ELEVENLABS_VOICE_ID!.trim();
	const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL;

	const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"xi-api-key": apiKey,
				"Content-Type": "application/json",
				Accept: "audio/mpeg",
			},
			body: JSON.stringify({
				text,
				model_id: modelId,
				voice_settings: {
					stability: 0.45,
					similarity_boost: 0.8,
				},
			}),
			cache: "no-store",
			signal: AbortSignal.timeout(120_000),
		});

		if (!res.ok) {
			const errText = await res.text();
			let msg = `ElevenLabs HTTP ${res.status}`;
			try {
				const j = JSON.parse(errText) as { detail?: { message?: string } | string };
				if (typeof j.detail === "string") msg = j.detail;
				else if (j.detail && typeof j.detail === "object" && "message" in j.detail && typeof j.detail.message === "string") {
					msg = j.detail.message;
				}
			} catch {
				if (errText) msg = errText.slice(0, 300);
			}
			return NextResponse.json({ error: msg }, { status: res.status >= 400 && res.status < 600 ? res.status : 502 });
		}

		const buf = Buffer.from(await res.arrayBuffer());
		return new NextResponse(buf, {
			status: 200,
			headers: {
				"Content-Type": "audio/mpeg",
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "Неизвестна грешка";
		return NextResponse.json({ error: `ElevenLabs: ${message}` }, { status: 503 });
	}
}
