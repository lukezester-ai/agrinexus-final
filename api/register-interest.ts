import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRegisterInterestPost } from '../lib/leads-handler';
import { vercelJsonBody } from '../lib/vercel-json-body';

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

  const parsed = vercelJsonBody(req.body);
  if (parsed === null) {
    res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    return;
  }

  const result = await handleRegisterInterestPost(parsed);
  if (result.ok) {
    res.status(200).json({ ok: true, preview: result.preview, mailDelivery: result.mailDelivery });
    return;
  }

  res.status(result.status).json({ ok: false, error: result.error, hint: result.hint });
}
