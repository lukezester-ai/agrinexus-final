import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFurrowChatPost, isAnyLlmConfigured } from '../verticals/agriculture/ai/furrow-chat-handler.js';

export const config = {
	maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.setHeader('Access-Control-Allow-Origin', '*');

	if (req.method === 'OPTIONS') {
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.status(204).end();
		return;
	}

	if (req.method === 'GET') {
		res.status(200).json({
			ok: true,
			path: '/api/furrow-chat',
			llmConfigured: isAnyLlmConfigured(),
			agentEnabled: process.env.FURROW_AGENT_DISABLED !== '1',
			agentTools: process.env.FURROW_AGENT_TOOLS === '1',
		});
		return;
	}

	if (req.method !== 'POST') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const clientIp =
		(typeof req.headers['x-forwarded-for'] === 'string'
			? req.headers['x-forwarded-for'].split(',')[0]?.trim()
			: null) || null;

	let rawBody: unknown = req.body;
	if (typeof req.body === 'string' && req.body.trim()) {
		try {
			rawBody = JSON.parse(req.body) as unknown;
		} catch {
			rawBody = null;
		}
	}

	const result = await handleFurrowChatPost(rawBody, { clientIp });
	if (result.ok === false) {
		res.status(result.status).json({ error: result.error, hint: result.hint });
		return;
	}

	res.status(200).json({
		reply: result.reply,
		agentMode: result.agentMode,
		actions: result.actions,
		knowledgeIds: result.knowledgeIds,
	});
}
