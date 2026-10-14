export type FurrowChatTurn = { role: 'user' | 'assistant'; content: string };

export type ToolCall = { id: string; type: string; function: { name: string; arguments: string } };

export type ChatMessage = {
	role: string;
	content?: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
};

export type AgentActionRecord = { tool: string; ok: boolean; summary: string };

export type AgentToolContext = { lang: 'en' | 'bg'; clientIp?: string | null; sessionId?: string };
