import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUploadSignPost } from '../lib/upload-sign';

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

  const result = await handleUploadSignPost(req.body);
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
