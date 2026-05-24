import { buildFurrowKnowledgeContext, getKnowledgeChunkIds } from './furrow-knowledge.js';
import type { ChatMessage, FurrowChatTurn } from './agent-types.js';
import { Redis } from '@upstash/redis';

const SYSTEM_EN = `You are "Furrow Analyst" — a highly professional, strict AI financial and agricultural market analyst for Furrow Markets (Nexus Group).

Tools:
• search_knowledge — platform facts (pricing tiers, regions, launch 2026, disclaimer)
• get_market_signals — delayed CBOT/Baltic snapshot (Yahoo, unofficial); cite as delayed
• get_weather_forecast — fetch latest weather for major agricultural regions
• search_web_news — fetch latest market news for a specific commodity or region
• submit_waitlist — early access ONLY when user gave full name + email and wants to join

Rules:
- Reply in English unless the user writes in Bulgarian — then reply in Bulgarian.
- You are a strict analyst. Maintain a Bloomberg/Reuters tone: concise, factual, analytical, and data-driven. Do NOT use overly enthusiastic language.
- CRITICAL: If the user asks for market analysis (e.g., about wheat, corn, weather), ALWAYS use \`get_weather_forecast\` and \`search_web_news\` FIRST to gather data before responding.
- For prices use get_market_signals; always note data is delayed/unofficial, not investment advice.
- Before submit_waitlist, confirm name and email with the user.
- After using a tool, concisely summarize the findings.
- No markdown code fences.`;

const SYSTEM_BG = `Вие сте „Furrow Analyst“ — строг и висококвалифициран финансов и агропазарен AI аналитик за Furrow Markets (Nexus Group).

Инструменти:
• search_knowledge — факти за платформата (цени, региони, старт 2026, отказ от отговорност)
• get_market_signals — забавен снимък CBOT/Baltic (Yahoo); винаги отбелязвайте забавянето
• get_weather_forecast — прогноза за ключови агрорегиони
• search_web_news — свежи пазарни новини по стока или регион
• submit_waitlist — ранен достъп САМО ако потребителят е дал име + email и иска да се запише

Правила:
- Отговаряйте на български, ако потребителят пише на български; иначе на английски.
- Стил Bloomberg/Reuters: кратко, фактологично, с данни. Без излишни емоции.
- КРИТИЧНО: При искане за пазарен анализ (пшеница, царевица, време) ВИНАГИ първо използвайте \`get_weather_forecast\` и \`search_web_news\`.
- За цени използвайте get_market_signals; данните са неофициални/забавени — не е инвестиционен съвет.
- Преди submit_waitlist потвърдете име и email.
- След инструмент кратко обобщение.
- Без markdown code fences.`;

const getRedisClient = () => {
	if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
		return new Redis({
			url: process.env.KV_REST_API_URL,
			token: process.env.KV_REST_API_TOKEN,
		});
	}
	return null;
};

export class MemoryAgent {
	private maxMessages: number;
	private redis: Redis | null;

	constructor(maxMessages: number = 12) {
		this.maxMessages = maxMessages;
		this.redis = getRedisClient();
	}

	private truncate(s: string, max: number): string {
		return s.length <= max ? s : `${s.slice(0, max)}…`;
	}

	public async loadHistory(sessionId: string): Promise<FurrowChatTurn[]> {
		if (!this.redis) return [];
		try {
			const data = await this.redis.get<FurrowChatTurn[]>(`furrow:chat:${sessionId}`);
			return Array.isArray(data) ? data : [];
		} catch (e) {
			console.error('Redis load error:', e);
			return [];
		}
	}

	public async saveHistory(sessionId: string, messages: FurrowChatTurn[]): Promise<void> {
		if (!this.redis) return;
		try {
			// Keep only the last maxMessages
			const toSave = messages.slice(-this.maxMessages);
			// Expiry of 24 hours (86400 seconds)
			await this.redis.set(`furrow:chat:${sessionId}`, toSave, { ex: 86400 });
		} catch (e) {
			console.error('Redis save error:', e);
		}
	}

	public async prepareMemory(
		sessionId: string,
		userMessageContent: string,
		lang: 'en' | 'bg'
	): Promise<{ chatMessages: ChatMessage[]; knowledgeIds: string[]; history: FurrowChatTurn[] }> {
		if (!userMessageContent.trim()) {
			throw new Error('User message cannot be empty');
		}

		// 1. Load previous history
		const history = await this.loadHistory(sessionId);

		// 2. Append new user message
		history.push({ role: 'user', content: this.truncate(userMessageContent.trim(), 2400) });

		// 3. Prepare Knowledge Context based on the latest message
		const knowledgeBlock = buildFurrowKnowledgeContext(userMessageContent);
		const knowledgeIds = getKnowledgeChunkIds(userMessageContent);
		const system = `${lang === 'bg' ? SYSTEM_BG : SYSTEM_EN}\n\n=== KNOWLEDGE ===\n${knowledgeBlock}`;

		// 4. Construct the full prompt for the LLM
		const chatMessages: ChatMessage[] = [
			{ role: 'system', content: system },
			...history.map((m) => ({ role: m.role, content: m.content })),
		];

		return { chatMessages, knowledgeIds, history };
	}
}
