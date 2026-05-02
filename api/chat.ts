import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Limits: see root vercel.json (functions for api routes). */
export const config = {
  maxDuration: 60,
};

function sendJson(res: VercelResponse, status: number, payload: Record<string, unknown>) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        path: '/api/chat',
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const [{ vercelJsonBody }, { handleChatPost }] = await Promise.all([
      import('../lib/vercel-json-body'),
      import('../lib/chat-handler'),
    ]);

    const parsed = vercelJsonBody(req.body);
    if (parsed === null) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const result = await handleChatPost(parsed);
    if (result.ok) {
      sendJson(res, 200, { reply: result.reply });
      return;
    }

    sendJson(res, result.status, {
      error: result.error,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  } catch (e) {
    console.error('[api/chat]', e);
    const msg = e instanceof Error ? e.message : 'Unexpected server error';
    sendJson(res, 500, {
      error: msg,
      hint:
        'Chat handler crashed. In Vercel: Logs → filter api/chat; confirm OPENAI_API_KEY exists for Production and redeploy.',
    });
  }
}
