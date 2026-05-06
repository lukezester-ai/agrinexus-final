import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUploadSignPost } from '../lib/upload-sign.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

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
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const authHeader =
    (typeof req.headers.authorization === 'string' && req.headers.authorization) ||
    (typeof req.headers.Authorization === 'string' && req.headers.Authorization) ||
    undefined;

  const result = await handleUploadSignPost(parsed, { authHeader });
  if (result.ok) {
    res.status(200).json({
      uploadUrl: result.uploadUrl,
      key: result.key,
      publicUrl: result.publicUrl,
    });
    return;
  }

  res.status(result.status).json({ error: result.error });
}
