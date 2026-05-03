import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import http from 'node:http';
import { readOpenAiApiKey } from '../lib/openai-api-key';
import { isChatLlmConfigured, isOllamaConfigured } from '../lib/ollama-env';
import { handleChatPost } from '../lib/chat-handler';
import { handleContactPost, handleFileMetaPost, handleRegisterInterestPost } from '../lib/leads-handler';
import { handleUploadSignPost } from '../lib/upload-sign';
import { handleMarketQuotesGet } from '../lib/market-quotes-handler';
import { handleDocumentExplainPost } from '../lib/document-explain-handler';
import { handleVisitPost, handleVisitStatsGet } from '../lib/visit-stats-handler';
import { getPlatformPayload } from '../lib/infra/platform-layers';
import {
	handleTransportDirectoryGet,
	handleTransportDirectoryPost,
} from '../lib/transport-directory-handler';

const PORT = Number(process.env.DEV_API_PORT || process.env.PORT || 8788);

/** Някои редактори записват `.env` с BOM — тогава първият ред не се разпознава като `OPENAI_API_KEY`. Препрочитаме файла. */
function mergeDotEnvWithoutBom(): void {
	const envPath = path.join(process.cwd(), '.env');
	if (!fs.existsSync(envPath)) return;
	try {
		const text = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
		const parsed = dotenv.parse(text);
		const apply = (key: string) => {
			const v = parsed[key];
			if (typeof v === 'string' && v.trim()) process.env[key] = v.trim();
		};
		apply('OPENAI_API_KEY');
		apply('OLLAMA_BASE_URL');
		apply('OLLAMA_MODEL');
		apply('OLLAMA_VISION_MODEL');
	} catch {
		/* ignore */
	}
}
mergeDotEnvWithoutBom();

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
      if (path === '/api/platform' && req.method === 'GET') {
        send(res, 200, getPlatformPayload());
        return;
      }

      if (path === '/api/transport-directory' && req.method === 'GET') {
        const r = await handleTransportDirectoryGet();
        send(res, 200, r);
        return;
      }

      if (path === '/api/transport-directory' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleTransportDirectoryPost(body);
        if (result.ok) {
          send(res, 200, { ok: true, company: result.company });
          return;
        }
        send(res, result.status, { ok: false, error: result.error });
        return;
      }

      if (path === '/api/chat' && req.method === 'GET') {
        send(res, 200, {
          ok: true,
          path: '/api/chat',
          openaiConfigured: readOpenAiApiKey().length > 0,
          ollamaConfigured: isOllamaConfigured(),
          llmConfigured: isChatLlmConfigured(),
        });
        return;
      }

      if (path === '/api/market-quotes' && req.method === 'GET') {
        send(res, 200, await handleMarketQuotesGet());
        return;
      }

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

      if (path === '/api/document-explain' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleDocumentExplainPost(body);
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
          send(res, 200, { ok: true, mailDelivery: result.mailDelivery });
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
          send(res, 200, {
            ok: true,
            preview: result.preview,
            mailDelivery: result.mailDelivery,
          });
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

      if (path === '/api/visit' && req.method === 'GET') {
        const auth =
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
        const result = await handleVisitStatsGet(auth);
        if (!result.ok) {
          send(res, result.status, { ok: false, error: result.error });
          return;
        }
        send(res, 200, {
          ok: true,
          totalSessions: result.totalSessions,
          uniqueVisitors: result.uniqueVisitors,
          updatedAt: result.updatedAt,
          storage: result.storage,
        });
        return;
      }

      if (path === '/api/visit' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleVisitPost(body);
        if (!result.ok) {
          send(res, result.status, { ok: false, error: result.error });
          return;
        }
        send(res, 200, {
          ok: true,
          totalSessions: result.totalSessions,
          uniqueVisitors: result.uniqueVisitors,
          storage: result.storage,
        });
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
