import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import http from 'node:http';
import { readOpenAiApiKey } from '../lib/openai-api-key';
import { isChatLlmConfigured } from '../lib/llm-env';
import { isMistralConfigured } from '../lib/mistral-env';
import { isOllamaConfigured } from '../lib/ollama-env';
import { handleChatPost } from '../lib/chat-handler';
import { handleContactPost, handleFileMetaPost, handleRegisterInterestPost } from '../lib/leads-handler';
import { handleUploadSignPost } from '../lib/upload-sign';
import { handleMarketQuotesGet } from '../lib/market-quotes-handler';
import { handleMarketWatchGet } from '../lib/market-watch-api';
import { persistMarketWatchSnapshot } from '../lib/market-watch-persist';
import { handleDocumentExplainPost } from '../lib/document-explain-handler';
import { handleVisitPost, handleVisitStatsGet } from '../lib/visit-stats-handler';
import { getPlatformPayload } from '../lib/infra/platform-layers';
import {
	handleOperationsHubGet,
	handleOperationsHubPost,
} from '../lib/operations-hub-handler';
import { chatDocDiscoveryRagFeatureEnabled } from '../lib/doc-discovery-chat-rag';
import { handleDocDiscoveryCronRequest } from '../lib/doc-discovery-cron-handler';
import { handleDocDiscoverySearchRequest } from '../lib/doc-discovery-search-handler';

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
		apply('MISTRAL_API_KEY');
		apply('MISTRAL_MODEL');
		apply('MISTRAL_CHAT_MODEL');
		apply('MISTRAL_MARKET_INSIGHTS_MODEL');
		apply('MISTRAL_VISION_MODEL');
		apply('OLLAMA_BASE_URL');
		apply('OLLAMA_MODEL');
		apply('OLLAMA_VISION_MODEL');
		apply('RESEND_API_KEY');
		apply('MAIL_FROM');
		apply('MAIL_TO');
		apply('CONTACT_TO_EMAIL');
		apply('AGRI_INBOX_EMAIL');
		apply('RESEND_FROM');
		apply('SMTP_FROM');
		apply('SMTP_HOST');
		apply('SMTP_PORT');
		apply('SMTP_SECURE');
		apply('SMTP_USER');
		apply('SMTP_PASS');
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

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      /** Коренът на dev API не е SPA — без това браузърът показва само {"error":"Not found"}. */
      if (path === '/' && req.method === 'GET') {
        send(res, 200, {
          ok: true,
          service: 'agrinexus-dev-api',
          hint: 'Use paths under /api/… Open the app at http://localhost:5173 (Vite proxies /api here).',
          discover: 'GET /api',
        });
        return;
      }

      if (path === '/api' && req.method === 'GET') {
        send(res, 200, {
          ok: true,
          routes: [
            { path: '/api/platform', methods: ['GET'] },
            { path: '/api/chat', methods: ['GET', 'POST'] },
            { path: '/api/market-quotes', methods: ['GET'] },
            { path: '/api/market-watch', methods: ['GET'] },
            { path: '/api/document-explain', methods: ['POST'] },
            { path: '/api/contact', methods: ['POST'] },
            { path: '/api/register-interest', methods: ['POST'] },
            { path: '/api/upload-sign', methods: ['POST'] },
            { path: '/api/file-meta', methods: ['POST'] },
            { path: '/api/visit', methods: ['GET', 'POST'] },
            { path: '/api/operations-hub', methods: ['GET', 'POST'] },
            { path: '/api/doc-discovery-cron', methods: ['GET', 'POST'] },
            { path: '/api/doc-discovery-search', methods: ['GET'] },
          ],
        });
        return;
      }

      if (path === '/api/platform' && req.method === 'GET') {
        send(res, 200, getPlatformPayload());
        return;
      }

      if (path === '/api/operations-hub' && req.method === 'GET') {
        const r = await handleOperationsHubGet();
        send(res, 200, r);
        return;
      }

      if (path === '/api/operations-hub' && req.method === 'POST') {
        const body = await readJson(req);
        if (body === null) {
          send(res, 400, { error: 'Invalid JSON' });
          return;
        }
        const result = await handleOperationsHubPost(body);
        if (result.ok === false) {
          send(res, result.status, { ok: false, error: result.error });
          return;
        }
        if ('conflict' in result && result.conflict === true) {
          send(res, 200, { ok: true, conflict: true, state: result.state });
          return;
        }
        send(res, 200, { ok: true, state: result.state });
        return;
      }

      if (path === '/api/chat' && req.method === 'GET') {
        send(res, 200, {
          ok: true,
          path: '/api/chat',
          openaiConfigured: readOpenAiApiKey().length > 0,
          mistralConfigured: isMistralConfigured(),
          ollamaConfigured: isOllamaConfigured(),
          llmConfigured: isChatLlmConfigured(),
          chatDocDiscoveryRag: chatDocDiscoveryRagFeatureEnabled(),
        });
        return;
      }

      if (path === '/api/market-quotes' && req.method === 'GET') {
        const marketQuotes = await handleMarketQuotesGet();
        if (marketQuotes.ok && marketQuotes.mode === 'live') {
          void persistMarketWatchSnapshot(marketQuotes.quotes, marketQuotes.fetchedAt);
        }
        send(res, 200, marketQuotes);
        return;
      }

      if (path === '/api/market-watch' && req.method === 'GET') {
        send(res, 200, await handleMarketWatchGet());
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
        const authHeader =
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
        const result = await handleUploadSignPost(body, { authHeader });
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

      if (path === '/api/doc-discovery-cron' && (req.method === 'GET' || req.method === 'POST')) {
        const auth =
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
        const r = await handleDocDiscoveryCronRequest({ method: req.method, authHeader: auth });
        send(res, r.status, r.body);
        return;
      }

      if (path === '/api/doc-discovery-search' && req.method === 'GET') {
        const auth =
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
        const r = await handleDocDiscoverySearchRequest({
          method: 'GET',
          queryParams: url.searchParams,
          authHeader: auth,
        });
        send(res, r.status, r.body);
        return;
      }

      send(res, 404, {
        error: 'Not found',
        path,
        method: req.method || 'GET',
        hint:
          'Expected a registered /api/… route and HTTP method. Open http://localhost:5173 for the UI (not this port alone). Try GET /api for a route list.',
      });
    } catch (e) {
      console.error('[dev-api]', e);
      send(res, 500, { error: 'Internal server error' });
    }
  });

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[agrinexus] dev API: port ${PORT} is already in use on 127.0.0.1. Change DEV_API_PORT in .env (same value Vite proxies to) or stop the other process.`,
    );
    console.error(`Windows: netstat -ano | findstr :${PORT}   then   taskkill /PID <pid> /F`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[agrinexus] dev API listening on http://127.0.0.1:${PORT}`);
});
