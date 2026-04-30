import 'dotenv/config';
import http from 'node:http';
import { handleChatPost } from '../lib/chat-handler';
import { handleContactPost, handleFileMetaPost, handleRegisterInterestPost } from '../lib/leads-handler';
import { handleUploadSignPost } from '../lib/upload-sign';

const PORT = Number(process.env.DEV_API_PORT || process.env.PORT || 8788);

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (path === '/api/chat' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleChatPost(body);
        if (result.ok) {
          send(res, 200, { reply: result.reply });
          return;
        }
        send(res, result.status, { error: result.error, hint: result.hint });
        return;
      }

      if (path === '/api/contact' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleContactPost(body);
        if (result.ok) {
          send(res, 200, { ok: true });
          return;
        }
        send(res, result.status, { ok: false, error: result.error, hint: result.hint });
        return;
      }

      if (path === '/api/register-interest' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleRegisterInterestPost(body);
        if (result.ok) {
          send(res, 200, { ok: true, preview: result.preview });
          return;
        }
        send(res, result.status, { ok: false, error: result.error, hint: result.hint });
        return;
      }

      if (path === '/api/upload-sign' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleUploadSignPost(body);
        if (result.ok) {
          send(res, 200, {
            uploadUrl: result.uploadUrl,
            key: result.key,
            publicUrl: result.publicUrl,
          });
          return;
        }
        send(res, result.status, { error: result.error });
        return;
      }

      if (path === '/api/file-meta' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleFileMetaPost(body);
        if (result.ok) {
          send(res, 200, { ok: true, received: result.received });
          return;
        }
        send(res, result.status, { ok: false, error: result.error });
        return;
      }

      send(res, 404, { error: 'Not found' });
    } catch (e) {
      console.error('[dev-api]', e);
      send(res, 500, { error: 'Internal server error' });
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`[agrinexus] dev API listening on http://127.0.0.1:${PORT}`);
  });
