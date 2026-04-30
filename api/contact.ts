import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleContactPost } from '../lib/leads-handler';

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

  const result = await handleContactPost(req.body);
  if (result.ok) {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(result.status).json({ ok: false, error: result.error, hint: result.hint });
}
