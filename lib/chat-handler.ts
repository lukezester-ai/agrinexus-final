export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type ChatLocale = 'bg' | 'en';

const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 6000;
const MAX_CONTEXT_CHARS = 14000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…`;
}

function systemPrompt(locale: ChatLocale, dealContext: string): string {
  const ctx = truncate(dealContext, MAX_CONTEXT_CHARS);
  const langRule =
    locale === 'bg'
      ? 'Отговаряй на български, освен ако потребителят изрично иска друг език.'
      : 'Reply in English unless the user clearly asks for another language.';

  return `You are AgriNexus AI — a cautious assistant for agricultural commodity trading between EU suppliers and MENA importers.
${langRule}

Rules:
- Treat deal rows below as illustrative demo data from the user's marketplace filter, not verified exchange quotes.
- Give BUY / HOLD / AVOID style opinions only as risk-aware heuristics; never promise profit or legal compliance.
- Mention certifications (HALAL, Saber, phytosanitary, etc.) and logistics risks when relevant.
- Keep answers concise (aim under ~220 words) unless the user asks for detail.

Current filtered deals context (IDs, routes, decisions, margins — demo):
${ctx}`;
}

function isChatTurn(v: unknown): v is ChatTurn {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string';
}

export async function handleChatPost(rawBody: unknown): Promise<
  { ok: true; reply: string } | { ok: false; status: number; error: string; hint?: string }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return {
      ok: false,
      status: 503,
      error: 'OpenAI is not configured',
      hint: 'OpenAI is not configured. Set OPENAI_API_KEY for this deployment.',
    };
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }

  const body = rawBody as Record<string, unknown>;
  const locale: ChatLocale = body.locale === 'en' ? 'en' : 'bg';
  const dealContext = typeof body.dealContext === 'string' ? body.dealContext : '';
  const messagesRaw = body.messages;

  if (!Array.isArray(messagesRaw)) {
    return { ok: false, status: 400, error: 'messages must be an array' };
  }

  const cleaned: ChatTurn[] = [];
  for (const m of messagesRaw.slice(-MAX_MESSAGES)) {
    if (!isChatTurn(m)) continue;
    const content = truncate(m.content.trim(), MAX_MESSAGE_CHARS);
    if (!content) continue;
    cleaned.push({ role: m.role, content });
  }

  if (cleaned.length === 0) {
    return { ok: false, status: 400, error: 'No valid messages' };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.35);
  const safeTemp = Number.isFinite(temperature) ? Math.min(1.2, Math.max(0, temperature)) : 0.35;

  const openaiMessages = [
    { role: 'system' as const, content: systemPrompt(locale, dealContext) },
    ...cleaned.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: safeTemp,
        max_tokens: 1400,
        messages: openaiMessages,
      }),
    });
  } catch {
    return { ok: false, status: 502, error: 'Upstream OpenAI request failed' };
  }

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    const detail = data.error?.message || res.statusText || 'OpenAI error';
    return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, error: detail };
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return { ok: false, status: 502, error: 'Empty model response' };
  }

  return { ok: true, reply };
}
