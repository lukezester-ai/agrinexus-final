import { openAIMessageContentToString, resolveVisionUpstream } from './llm-routing.js';

export type DocumentExplainLocale = 'bg' | 'en';

/** ~5 MiB raw image after base64 decode — rough guard via character count */
const MAX_BASE64_CHARS = 6_800_000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function systemPrompt(locale: DocumentExplainLocale): string {
  if (locale === 'bg') {
    return `Ти си AgriNexus AI — внимателен помощник за агротърговия (EU ↔ MENA).
Потребителят е качил снимка на документ (официално писмо, сертификат, фактура, екран и т.н.).

Правила:
- Обясни на ясен български какво се вижда: тип документ, ключови дати, суми (винаги в евро EUR ако има валута — не ползвай лева/BGN дори да са споменати исторически).
- Ако текстът не се чете — кажи честно; не измисляй съдържание.
- Не давай правни или финансови гаранции; напомни за проверка с екипа или счетоводство при реални действия.
- Ако темата е извън търговия/логистика/сертификати, отговори кратко и предложи контакт с екипа.
Отговорът да е обикновен текст (без JSON).`;
  }

  return `You are AgriNexus AI — a cautious assistant for agricultural commodity trading (EU ↔ MENA).
The user uploaded an image of a document.

Rules:
- Explain clearly what you see: document type, key dates, amounts (prefer stating EUR when discussing money; avoid presenting BGN as primary display currency).
- If unreadable, say so honestly; do not invent text.
- No legal or financial guarantees; suggest verification with their team when appropriate.
- If off-topic for trade/logistics/certificates, answer briefly and suggest contacting the team.
Plain text only (no JSON).`;
}

export async function handleDocumentExplainPost(rawBody: unknown): Promise<
  { ok: true; reply: string } | { ok: false; status: number; error: string; hint?: string }
> {
  const visionUp = resolveVisionUpstream();
  if (!visionUp) {
    return {
      ok: false,
      status: 503,
      error: 'LLM is not configured',
      hint:
        'Set MISTRAL_API_KEY (Pixtral vision), OPENAI_API_KEY, or local OLLAMA_BASE_URL with OLLAMA_VISION_MODEL (e.g. llava).',
    };
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }

  const body = rawBody as Record<string, unknown>;
  const rawLocale = typeof body.locale === 'string' ? body.locale : '';
  const locale: DocumentExplainLocale = rawLocale === 'en' ? 'en' : 'bg';
  const sessionEmail = typeof body.sessionEmail === 'string' ? body.sessionEmail.trim() : '';
  if (sessionEmail && !isValidEmail(sessionEmail)) {
    return {
      ok: false,
      status: 400,
      error:
        locale === 'bg'
          ? 'Невалиден имейл в sessionEmail (или го пропуснете).'
          : 'Invalid sessionEmail (or omit it).',
    };
  }

  let imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeTypeRaw = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';

  const dataUrlMatch = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(imageBase64);
  let mimeType = mimeTypeRaw;
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    imageBase64 = dataUrlMatch[2].trim();
  }

  const mimeNormalized = (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType || 'image/jpeg').toLowerCase();
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
  if (!allowed.includes(mimeNormalized as (typeof allowed)[number])) {
    return {
      ok: false,
      status: 400,
      error:
        locale === 'bg'
          ? 'Поддържаме само изображения: JPEG, PNG, WebP или GIF. За PDF заснемете страницата като снимка.'
          : 'Only JPEG, PNG, WebP, or GIF images. For PDF, photograph the page.',
    };
  }

  if (!imageBase64 || imageBase64.length > MAX_BASE64_CHARS) {
    return {
      ok: false,
      status: 400,
      error:
        locale === 'bg'
          ? 'Липсва изображение или файлът е твърде голям (напр. до ~5 MB).'
          : 'Image missing or too large (e.g. max ~5 MB).',
    };
  }

  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim().slice(0, 2000)
      : locale === 'bg'
        ? 'Обясни какво казва документът и какво е важно за търговец на агрокомодитети.'
        : 'Explain what the document says and what matters for an agri commodity trader.';

  const { provider: visionProvider, completionUrl, bearer, model } = visionUp;
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.35);
  const safeTemp = Number.isFinite(temperature) ? Math.min(1.2, Math.max(0, temperature)) : 0.35;

  /** Mistral: `image_url` е низ (URL или data:...). OpenAI/Ollama: обект с `url` (+ optional detail). */
  const dataUrl = `data:${mimeNormalized};base64,${imageBase64}`;
  const imageContentPart =
    visionProvider === 'mistral'
      ? ({ type: 'image_url' as const, image_url: dataUrl })
      : ({
          type: 'image_url' as const,
          image_url: { url: dataUrl, detail: 'high' as const },
        });

  const messages = [
    { role: 'system' as const, content: systemPrompt(locale) },
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: question }, imageContentPart],
    },
  ];

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  let res: Response;
  try {
    res = await fetch(completionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: safeTemp,
        max_tokens: 2000,
        messages,
      }),
    });
  } catch {
    const label =
      visionProvider === 'mistral'
        ? 'Mistral'
        : visionProvider === 'ollama'
          ? 'Ollama'
          : 'OpenAI';
    return {
      ok: false,
      status: 502,
      error: `Upstream ${label} request failed`,
      hint:
        visionProvider === 'ollama'
          ? 'Pull a vision model: ollama pull llava (or set OLLAMA_VISION_MODEL). Is Ollama running?'
          : visionProvider === 'mistral'
            ? 'Check MISTRAL_API_KEY and MISTRAL_VISION_MODEL (Pixtral) at console.mistral.ai.'
            : undefined,
    };
  }

  let data: {
    error?: { message?: string };
    choices?: { message?: { content?: unknown } }[];
  };
  try {
    const raw = await res.text();
    if (!raw.trim()) {
      return { ok: false, status: 502, error: 'Empty upstream response body' };
    }
    data = JSON.parse(raw) as typeof data;
  } catch {
    return { ok: false, status: 502, error: 'Upstream returned invalid JSON' };
  }

  if (!res.ok) {
    const fallback =
      visionProvider === 'mistral'
        ? 'Mistral error'
        : visionProvider === 'ollama'
          ? 'Ollama error'
          : 'OpenAI error';
    const detail = data.error?.message || res.statusText || fallback;
    return {
      ok: false,
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
      error: detail,
    };
  }

  const rawReply = openAIMessageContentToString(data.choices?.[0]?.message?.content);
  if (!rawReply) {
    return { ok: false, status: 502, error: 'Empty model response' };
  }

  return { ok: true, reply: rawReply.slice(0, 12000) };
}
