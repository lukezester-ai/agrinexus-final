import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatDocDiscoveryRagFeatureEnabled } from '../lib/doc-discovery-chat-rag.js';
import { handleChatPost } from '../lib/chat-handler.js';
import { isOpenAiConfigured } from '../lib/openai-api-key.js';
import { isMistralConfigured } from '../lib/mistral-env.js';
import { isOllamaConfigured } from '../lib/ollama-env.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

/** Limits: see root vercel.json (functions for api routes). */
export const config = {
  maxDuration: 60,
};

/** Нативен Node отговор — без `res.status()` / `res.json()` (понякога липсват при invocation → двойна грешка и FUNCTION_INVOCATION_FAILED). */
function sendJson(res: VercelResponse, code: number, payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

/** Същото като `isAnyLlmConfigured` без да се импортира `llm-routing` при GET (по-малък cold bundle). */
function llmConfiguredSnapshot(): boolean {
  return isMistralConfigured() || isOllamaConfigured() || isOpenAiConfigured();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        path: '/api/chat',
        openaiConfigured: isOpenAiConfigured(),
        mistralConfigured: isMistralConfigured(),
        ollamaConfigured: isOllamaConfigured(),
        llmConfigured: llmConfiguredSnapshot(),
        chatDocDiscoveryRag: chatDocDiscoveryRagFeatureEnabled(),
      });
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

    const result = await handleChatPost(parsed);
    if (result.ok) {
      sendJson(res, 200, { reply: result.reply });
      return;
    }

    sendJson(res, result.status, {
      error: result.error,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  } catch (e) {
    console.error('[api/chat]', e);
    const msg = e instanceof Error ? e.message : 'Unexpected server error';
    try {
      sendJson(res, 500, {
        error: msg,
        hint:
          'If this persists: Vercel → Logs → api/chat; confirm MISTRAL_API_KEY or OPENAI_API_KEY for Production and Redeploy.',
      });
    } catch (sendErr) {
      console.error('[api/chat] sendJson in catch failed', sendErr);
      try {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } catch {
        /* ignore */
      }
    }
  }
}
