import { isAnyLlmConfigured, resolveTextChatUpstream } from './llm-upstream.js';
import { WorkflowAgent } from './agent-workflow.js';
import type { AgentActionRecord } from './agent-types.js';

export async function handleFurrowChatPost(
	rawBody: unknown,
	opts?: { clientIp?: string | null },
): Promise<
	| { ok: true; reply: string; agentMode: boolean; actions?: AgentActionRecord[]; knowledgeIds?: string[] }
	| { ok: false; status: number; error: string; hint?: string }
> {
	const upstream = resolveTextChatUpstream();
	if (!upstream) {
		return {
			ok: false,
			status: 503,
			error: 'LLM not configured',
			hint: 'Set MISTRAL_API_KEY (or OPENAI_API_KEY) in environment and redeploy.',
		};
	}

	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}

	const body = rawBody as Record<string, unknown>;
	
	// Support both legacy "messages" array and new "message" string
	let userMessageContent = '';
	if (typeof body.message === 'string') {
		userMessageContent = body.message;
	} else if (Array.isArray(body.messages) && body.messages.length > 0) {
		const lastMsg = body.messages[body.messages.length - 1];
		if (lastMsg && typeof lastMsg.content === 'string') {
			userMessageContent = lastMsg.content;
		}
	}

	if (!userMessageContent) {
		return { ok: false, status: 400, error: 'User message is required' };
	}

	const sessionId = typeof body.sessionId === 'string' ? body.sessionId : 'anonymous-session';

	const lang: 'en' | 'bg' =
		body.context && typeof body.context === 'object' && (body.context as { lang?: string }).lang === 'bg'
			? 'bg'
			: body.context && typeof body.context === 'object' && (body.context as { lang?: string }).lang === 'ru'
				? 'bg'
				: 'en';

	const workflow = new WorkflowAgent();
	return workflow.run(upstream, userMessageContent, sessionId, lang, opts);
}

export { isAnyLlmConfigured };
