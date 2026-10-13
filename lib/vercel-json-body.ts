/**
 * On Vercel, `req.body` may be a parsed object or a raw string/buffer depending on config/runtime.
 * Dev server always parses to an object before calling handlers.
 */
export function vercelJsonBody(body: unknown): unknown | null {
  if (body == null) return body;
  if (typeof body === 'object') return body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    try {
      const s = body.toString('utf8').trim();
      if (!s) return {};
      return JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }
  return body;
}
