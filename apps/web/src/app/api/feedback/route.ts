import { NextRequest, NextResponse } from "next/server";
import { Langfuse } from "langfuse-node";

const isLangfuseConfigured = Boolean(process.env.LANGFUSE_SECRET_KEY);

const langfuse = isLangfuseConfigured ? new Langfuse({
	publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY,
	secretKey: process.env.LANGFUSE_SECRET_KEY,
	baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_HOST || process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
}) : null;

export async function POST(req: NextRequest) {
	if (!isLangfuseConfigured) {
		return NextResponse.json({ error: "Langfuse is not configured" }, { status: 400 });
	}

	try {
		const body = await req.json();
		const { traceId, value, comment } = body;

		if (!traceId) {
			return NextResponse.json({ error: "traceId is required" }, { status: 400 });
		}

		// Submit score to Langfuse
		// value: 1 for thumbs up, 0 for thumbs down
		await langfuse?.score({
			traceId,
			name: "user-feedback",
			value,
			comment,
		});

		await langfuse?.flushAsync();

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Feedback error:", error);
		return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
	}
}
