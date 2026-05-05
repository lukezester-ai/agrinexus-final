import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleDocumentExplainPost } from '../lib/document-explain-handler.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

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

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const parsed = vercelJsonBody(req.body);
    if (parsed === null) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const result = await handleDocumentExplainPost(parsed);
    if (result.ok) {
      sendJson(res, 200, { reply: result.reply });
      return;
    }

    sendJson(res, result.status, {
      error: result.error,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  } catch (e) {
    console.error('[api/document-explain]', e);
    const msg = e instanceof Error ? e.message : 'Unexpected server error';
    sendJson(res, 500, { error: msg });
  }
}
