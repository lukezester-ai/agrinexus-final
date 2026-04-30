import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleChatPost } from '../lib/chat-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const result = await handleChatPost(req.body);
  if (result.ok) {
    res.status(200).json({ reply: result.reply });
    return;
  }

  res.status(result.status).json({ error: result.error, hint: result.hint });
}
