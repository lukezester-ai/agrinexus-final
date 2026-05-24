import { buildFurrowKnowledgeContext } from './furrow-knowledge.js';
import {
	formatSignalsForAgent,
	getFurrowMarketSignals,
	refreshFurrowMarketSignals,
} from './furrow-market-signals.js';
import { submitFurrowWaitlist } from './waitlist.js';

export type AgentActionRecord = { tool: string; ok: boolean; summary: string };
export type AgentToolContext = { lang: 'en' | 'bg'; clientIp?: string | null };

export const FURROW_AGENT_TOOLS = [
	{
		type: 'function' as const,
		function: {
			name: 'search_knowledge',
			description: 'Search Furrow platform knowledge: pricing, coverage, launch, disclaimer, waitlist.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Topic or keywords' },
				},
				required: ['query'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'get_market_signals',
			description:
				'Get delayed CBOT grain futures and Baltic Dry index snapshot (Yahoo Finance, unofficial). Use for wheat/corn/soy/shipping questions.',
			parameters: {
				type: 'object',
				properties: {
					refresh: {
						type: 'boolean',
						description: 'If true, force refresh from Yahoo instead of cache',
					},
				},
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'submit_waitlist',
			description:
				'Add user to Furrow early-access waitlist. ONLY when user gave name + email and explicitly wants to join waitlist or subscribe.',
			parameters: {
				type: 'object',
				properties: {
					full_name: { type: 'string' },
					email: { type: 'string' },
					interest: {
						type: 'string',
						enum: ['grains', 'livestock', 'dairy', 'softs', 'fertilizer', 'all'],
					},
				},
				required: ['full_name', 'email'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'search_web_news',
			description: 'Search the web for the latest agricultural market news and geopolitical events.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Keywords to search for (e.g. "Russian wheat exports 2026")' },
				},
				required: ['query'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function' as const,
		function: {
			name: 'get_weather_forecast',
			description: 'Get the latest weather forecast and soil moisture conditions for major agricultural regions.',
			parameters: {
				type: 'object',
				properties: {
					region: { type: 'string', description: 'Region name (e.g. "Black Sea", "US Plains", "Brazil")' },
				},
				required: ['region'],
				additionalProperties: false,
			},
		},
	},
] as const;

export async function executeFurrowAgentTool(
	name: string,
	argsJson: string,
	ctx: AgentToolContext,
): Promise<{ result: string; action: AgentActionRecord }> {
	let args: Record<string, unknown> = {};
	try {
		args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
	} catch {
		return {
			result: JSON.stringify({ error: 'Invalid tool arguments JSON' }),
			action: { tool: name, ok: false, summary: 'Invalid JSON' },
		};
	}

	if (name === 'search_knowledge') {
		const query = typeof args.query === 'string' ? args.query : '';
		const block = buildFurrowKnowledgeContext(query || 'furrow pricing launch');
		return {
			result: JSON.stringify({ ok: true, knowledge: block }),
			action: { tool: name, ok: true, summary: 'Knowledge search' },
		};
	}

	if (name === 'get_market_signals') {
		const refresh = args.refresh === true;
		try {
			const signals = refresh
				? await refreshFurrowMarketSignals()
				: await getFurrowMarketSignals();
			const text = formatSignalsForAgent(signals, ctx.lang);
			return {
				result: JSON.stringify({ ok: true, signals, summary: text }),
				action: {
					tool: name,
					ok: true,
					summary: refresh ? 'Refreshed market signals' : 'Market signals',
				},
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Signals failed';
			return {
				result: JSON.stringify({ ok: false, error: msg }),
				action: { tool: name, ok: false, summary: msg },
			};
		}
	}

	if (name === 'submit_waitlist') {
		const fullName = typeof args.full_name === 'string' ? args.full_name : '';
		const email = typeof args.email === 'string' ? args.email : '';
		const interest = typeof args.interest === 'string' ? args.interest : 'all';
		const out = await submitFurrowWaitlist({ fullName, email, interest, lang: ctx.lang });
		if (out.ok === false) {
			return {
				result: JSON.stringify(out),
				action: { tool: name, ok: false, summary: out.error },
			};
		}
		const summary =
			ctx.lang === 'en'
				? 'Waitlist email sent to team'
				: 'Письмо в команду отправлено';
		return {
			result: JSON.stringify(out),
			action: { tool: name, ok: true, summary },
		};
	}

	if (name === 'search_web_news') {
		const query = typeof args.query === 'string' ? args.query : '';
		// Mocked data for now
		const mockNews = [
			`(MOCK) Bloomberg: ${query} causing market ripples as traders adjust positions.`,
			`(MOCK) Reuters: Global supply chains monitor developments regarding ${query}.`,
		];
		return {
			result: JSON.stringify({ ok: true, news: mockNews }),
			action: { tool: name, ok: true, summary: `Web search: ${query}` },
		};
	}

	if (name === 'get_weather_forecast') {
		const region = typeof args.region === 'string' ? args.region : '';
		// Mocked data for now
		const mockWeather = `(MOCK) ${region}: Persistent dry conditions in the southern areas, expected rainfall of 10-15mm over the next week in the north. Soil moisture remains below optimal.`;
		return {
			result: JSON.stringify({ ok: true, weather: mockWeather }),
			action: { tool: name, ok: true, summary: `Weather: ${region}` },
		};
	}

	return {
		result: JSON.stringify({ error: `Unknown tool: ${name}` }),
		action: { tool: name, ok: false, summary: 'Unknown tool' },
	};
}
