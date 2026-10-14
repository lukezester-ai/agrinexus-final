import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabase";
import LRU from "lru-cache";

// Simple in‑memory rate limiter: max 5 requests / minute per IP
const limiter = new LRU<string, { count: number; reset: number }>({
  max: 500,
  ttl: 60 * 1000, // 1 min
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---- Rate limiting ----
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = limiter.get(ip);
  if (record && now < record.reset) {
    if (record.count >= 5) {
      return res.status(429).json({ error: "Too many requests" });
    }
    record.count += 1;
    limiter.set(ip, record);
  } else {
    limiter.set(ip, { count: 1, reset: now + 60 * 1000 });
  }

  // ---- Auth ----
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  const { name, description, instructions } = req.body as {
    name?: string;
    description?: string;
    instructions?: string;
  };

  if (!name || !description || !instructions) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // ---- Call LLM (placeholder) ----
  // In a real implementation replace the block below with a call to OpenAI / Anthropic SDK.
  // The secret key must be stored in a server‑only env var, e.g. OPENAI_API_KEY.
  const improved = {
    name: `[AI] ${name}`,
    description: `[AI] ${description}`,
    instructions: `[AI] ${instructions}`,
  };

  return res.status(200).json(improved);
}
