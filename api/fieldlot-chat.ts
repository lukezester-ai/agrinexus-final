import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFieldlotChatPost } from '../lib/fieldlot-llm-handler.js';
import { isOpenAiConfigured } from '../lib/openai-api-key.js';
import { isMistralConfigured } from '../lib/mistral-env.js';
import { isOllamaConfigured } from '../lib/ollama-env.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';

export const config = {
	maxDuration: 45,
};

function sendJson(res: VercelResponse, code: number, payload: Record<string, unknown>): void {
	const body = JSON.stringify(payload);
	res.statusCode = code;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(body);
}

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
				path: '/api/fieldlot-chat',
				llmConfigured: llmConfiguredSnapshot(),
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

		const result = await handleFieldlotChatPost(parsed);
		if (result.ok) {
			sendJson(res, 200, { reply: result.reply });
			return;
		}

		sendJson(res, result.status, { error: result.error, hint: result.hint });
	} catch (e) {
		console.error('[api/fieldlot-chat]', e);
		sendJson(res, 500, { error: 'Internal error' });
	}
}
