import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleChatPost } from '../lib/chat-handler';
import { vercelJsonBody } from '../lib/vercel-json-body';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({
        ok: true,
        path: '/api/chat',
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const parsed = vercelJsonBody(req.body);
    if (parsed === null) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const result = await handleChatPost(parsed);
    if (result.ok) {
      res.status(200).json({ reply: result.reply });
      return;
    }

    res.status(result.status).json({ error: result.error, hint: result.hint });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected server error';
    res.status(500).json({
      error: msg,
      hint: 'Chat handler crashed. Check Vercel Function logs and OPENAI_API_KEY.',
    });
  }
}
