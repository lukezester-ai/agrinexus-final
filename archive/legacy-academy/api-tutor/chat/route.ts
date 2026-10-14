import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, userId, culture, region, threadId, mode = "general" } = body;

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    const response = await fetch(`${backendUrl}/tutor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        user_id: userId,
        culture,
        region,
        thread_id: threadId || `chat_${userId}_${Date.now()}`,
        mode,                    // "general", "market", "risk_weather" и т.н.
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Backend error: ${errorData}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error in /tutor/chat route:", error);
    return NextResponse.json({ error: "Failed to connect to backend tutor API." }, { status: 500 });
  }
}
