import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AGN_POLICY } from './lib/agrinexus-policy.js';
import { getChatMistral } from './lib/mistral-client.js';
import { fetchMarketSnapshotForLlm } from './lib/market-snapshot.js';
import { checkRateLimit, clientIpFromVercelRequest } from './lib/rate-limit.js';

type RouteKey =
	| 'MARKET_AGENT'
	| 'ANALYTICS_AGENT'
	| 'WEATHER_AGENT'
	| 'CROP_AGENT'
	| 'FIELD_AGENT'
	| 'OPERATIONS_AGENT'
	| 'FINANCE_AGENT'
	| 'COMPLIANCE_AGENT'
	| 'SUSTAINABILITY_AGENT'
	| 'NEWS_AGENT'
	| 'ACADEMY_AGENT'
	| 'GENERAL_RESPONSE';

interface AgentState {
	messages: unknown[];
	currentTask: string | null;
	agentResponse: string | null;
	lastRoute: string | null;
}

function logJson(event: string, fields: Record<string, unknown>) {
	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			service: 'agrinexus-api-chat',
			event,
			...fields,
		}),
	);
}

function normalizeRoute(raw: string): RouteKey {
	const u = raw.toUpperCase();
	if (u.includes('COMPLIANCE') || u.includes('SUBSID') || u.includes('CAP') || u.includes('GLOBALGAP')) {
		return 'COMPLIANCE_AGENT';
	}
	if (u.includes('CARBON') || u.includes('ESG') || u.includes('SUSTAIN') || u.includes('EMISSION')) {
		return 'SUSTAINABILITY_AGENT';
	}
	if (u.includes('FINANCE') || u.includes('CASH') || u.includes('P&L') || u.includes('MARGIN') || u.includes('ROI')) {
		return 'FINANCE_AGENT';
	}
	if (u.includes('NEWS') || u.includes('HEADLINE') || u.includes('REPORT') || u.includes('SOURCE')) {
		return 'NEWS_AGENT';
	}
	if (u.includes('FIELD') || u.includes('SATELLITE') || u.includes('NDVI') || u.includes('DISEASE') || u.includes('WEED')) {
		return 'FIELD_AGENT';
	}
	if (u.includes('CROP') || u.includes('SEED') || u.includes('NUTRITION') || u.includes('FERTIL') || u.includes('ROTATION')) {
		return 'CROP_AGENT';
	}
	if (u.includes('OPERATIONS') || u.includes('FLEET') || u.includes('LABOR') || u.includes('INVENTORY') || u.includes('TASK')) {
		return 'OPERATIONS_AGENT';
	}
	if (u.includes('ANALYTIC')) return 'ANALYTICS_AGENT';
	if (u.includes('MARKET')) return 'MARKET_AGENT';
	if (u.includes('WEATHER') || u.includes('AGRONOM') || u.includes('IRRIGATION')) return 'WEATHER_AGENT';
	if (
		u.includes('ACADEMY') ||
		u.includes('LEARN') ||
		u.includes('CURRICULUM') ||
		u.includes('COURSE') ||
		u.includes('LESSON') ||
		u.includes('TUTOR')
	) {
		return 'ACADEMY_AGENT';
	}
	return 'GENERAL_RESPONSE';
}

const orchestrator = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_ORCHESTRATOR_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const userQuery = String(lastMessage.content ?? '');

	const prompt = new SystemMessage(
		`You are the AgriNexus Orchestrator. Route the user message to exactly ONE key (output ONLY the key, no markdown):
ANALYTICS_AGENT — charts/dashboards, multi-series futures, volatility, "what does this pattern mean", CBOT desk / Analytics Lab style questions (explain, no trade signals).
MARKET_AGENT — prices, futures, selling/buying crops, hedging, spreads, export parity (execution / timing mindset).
WEATHER_AGENT — weather, rainfall, temperature forecasts, irrigation timing, frost risk (not prices).
CROP_AGENT — crop lifecycle questions: planning, rotations, varieties, seeding windows, soil nutrition, fertilizer concepts.
FIELD_AGENT — monitoring and detection: satellite/NDVI/NDWI, disease, weed scouting, field anomalies, drone or photo checks.
OPERATIONS_AGENT — farm work execution: fleet, labor, tasks, machinery scheduling, inventory, work orders.
FINANCE_AGENT — farm finance: P&L, cash flow, break-even, margins, budgets, field-level economics.
COMPLIANCE_AGENT — CAP/subsidy paperwork, audit trails, GlobalGAP/GAP, records, traceability, regulatory checklists.
SUSTAINABILITY_AGENT — carbon, ESG, MRV, emissions, soil health reporting, sustainability tradeoffs.
NEWS_AGENT — news monitoring, headlines, source triage, market-moving or weather-moving events without live browsing.
ACADEMY_AGENT — learning paths, courses, curriculum, AgriNexus Academy, podcasts, "how do I learn", study plans.
GENERAL_RESPONSE — everything else (farm ops UI, greetings, vague questions).

Output ONLY one of: ANALYTICS_AGENT | MARKET_AGENT | WEATHER_AGENT | CROP_AGENT | FIELD_AGENT | OPERATIONS_AGENT | FINANCE_AGENT | COMPLIANCE_AGENT | SUSTAINABILITY_AGENT | NEWS_AGENT | ACADEMY_AGENT | GENERAL_RESPONSE`,
	);

	const response = await llm.invoke([prompt, new HumanMessage(userQuery)]);
	const raw = String(response.content ?? '').trim();
	const decision = normalizeRoute(raw);
	logJson('orchestrator_decision', { route: decision, rawSnippet: raw.slice(0, 120), ms: Date.now() - t0 });
	return { currentTask: decision };
};

const marketAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_MARKET_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const snapshot = await fetchMarketSnapshotForLlm();
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Market Intelligence Agent (FIN/MRK).
Use ONLY the numbers in the snapshot below for current futures references. If the snapshot says unavailable, explain that live data is missing and avoid inventing prices.
Add a one-line disclaimer that Yahoo data is delayed and not investment advice.

${snapshot}`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('market_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'marketAgent' };
};

const analyticsAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(
		process.env.MISTRAL_ANALYTICS_AGENT_MODEL?.trim() || process.env.MISTRAL_MARKET_AGENT_MODEL?.trim(),
	);
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const snapshot = await fetchMarketSnapshotForLlm();
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus **AI Analytics** agent (codename ANL / FIN-ANL).
You steward the Analytics desk: explain delayed multi-commodity futures, volatility regimes, and how to read chart-style summaries using ONLY the numbers in the snapshot.
Do not invent prices. No buy/sell instructions — educational framing only. One-line disclaimer: Yahoo data is delayed; not investment advice.

${snapshot}`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('analytics_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'analyticsAgent' };
};

const weatherAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_WEATHER_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Weather & Agronomy Agent.
Give practical educational guidance (soil moisture concepts, sowing windows, risk checklists). Do NOT invent specific temperatures, mm of rain, or dated forecasts. Tell the user to check national/local meteorology and their agronomist before operational decisions.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('weather_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'weatherAgent' };
};

const cropAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_CROP_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Crop Lifecycle Agent (PLN/SED/NUT).
Help with crop planning, rotations, variety choice, seeding concepts, soil tests, nutrient balance, and variable-rate fertilizer reasoning.
Do not prescribe exact chemical doses or regulated treatments without local labels, soil tests, and an agronomist. Prefer checklists, assumptions, and next measurements.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('crop_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'cropAgent' };
};

const fieldAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_FIELD_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Field Monitoring Agent (SAT/DIS/WDS).
Explain satellite indices, field anomalies, scouting priorities, disease/weed detection workflows, and what evidence to collect next.
Do not claim to have inspected live satellite imagery or photos unless the user provided them. Avoid definitive pest/disease diagnosis; give probability-style reasoning and verification steps.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('field_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'fieldAgent' };
};

const operationsAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_OPERATIONS_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Operations Agent (FLT/LAB/INV).
Help turn farm decisions into safe work plans: fleet scheduling, labor allocation, task sequencing, inventory checks, and maintenance reminders.
Do not pretend to execute actions. Present approvals, prerequisites, safety checks, and rollback/kill-switch thinking before any automation.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('operations_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'operationsAgent' };
};

const financeAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_FINANCE_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Farm Finance Agent (FIN).
Help with field-level P&L, break-even thinking, cash-flow timing, budgets, sensitivity analysis, and accounting-ready summaries.
Use clearly labeled assumptions when numbers are missing. Do not provide tax, legal, credit, or investment advice; recommend a qualified accountant/advisor for binding decisions.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('finance_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'financeAgent' };
};

const complianceAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_COMPLIANCE_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Compliance Agent (CMP).
Help farmers organize records, CAP/subsidy evidence, audit trails, traceability, and GAP/GlobalGAP preparation.
Do not give legal advice or claim current regulation unless supplied by the user. Frame answers as document checklists and questions to confirm with the relevant authority or certifier.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('compliance_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'complianceAgent' };
};

const sustainabilityAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_SUSTAINABILITY_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Sustainability & Carbon Agent (CO2).
Help with emissions boundaries, soil health indicators, MRV workflows, carbon-credit readiness, and sustainability tradeoffs.
Avoid unverifiable credit claims. Distinguish measurement, estimate, and certification, and recommend verified local programs for monetization.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('sustainability_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'sustainabilityAgent' };
};

const newsAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_NEWS_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus News Intelligence Agent (NWS).
Help triage agricultural headlines, explain what types of events matter for crops, logistics, weather, policy, and markets, and build monitoring briefs.
You do not have live news access in this endpoint. If the user asks for current headlines, ask them to provide sources or use the latest verified feed before drawing conclusions.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('news_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'newsAgent' };
};

const academyAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_ACADEMY_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const snapshot = await fetchMarketSnapshotForLlm();
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Academy Tutor. You help learners navigate modern farming topics (risk, markets, data literacy).
Use the LIVE market snapshot below only as teaching material (explain how to read delayed futures, basis, volatility) — not as trading advice.

${snapshot}`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('academy_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'academyAgent' };
};

const generalAgent = async (state: AgentState) => {
	const t0 = Date.now();
	const llm = getChatMistral(process.env.MISTRAL_GENERAL_AGENT_MODEL?.trim());
	const lastMessage = state.messages[state.messages.length - 1] as HumanMessage;
	const prompt = new SystemMessage(
		`${AGN_POLICY}

You are the AgriNexus Conversation Interface (CNV).
Answer helpfully and concisely. If the user mixes topics, acknowledge it and focus on what you can support.`,
	);
	const response = await llm.invoke([prompt, lastMessage]);
	logJson('general_agent_done', { ms: Date.now() - t0 });
	return { agentResponse: response.content, currentTask: 'DONE', lastRoute: 'generalAgent' };
};

const routeQuery = (state: AgentState) => {
	const t = state.currentTask;
	if (t === 'ANALYTICS_AGENT') return 'analyticsAgent';
	if (t === 'MARKET_AGENT') return 'marketAgent';
	if (t === 'WEATHER_AGENT') return 'weatherAgent';
	if (t === 'CROP_AGENT') return 'cropAgent';
	if (t === 'FIELD_AGENT') return 'fieldAgent';
	if (t === 'OPERATIONS_AGENT') return 'operationsAgent';
	if (t === 'FINANCE_AGENT') return 'financeAgent';
	if (t === 'COMPLIANCE_AGENT') return 'complianceAgent';
	if (t === 'SUSTAINABILITY_AGENT') return 'sustainabilityAgent';
	if (t === 'NEWS_AGENT') return 'newsAgent';
	if (t === 'ACADEMY_AGENT') return 'academyAgent';
	return 'generalAgent';
};

const workflow = new StateGraph<AgentState>({
	channels: {
		messages: {
			value: (x: unknown[], y: unknown[]) => x.concat(y),
			default: () => [],
		},
		currentTask: {
			value: (x: string | null, y: string | null) => y ?? x,
			default: () => null,
		},
		agentResponse: {
			value: (x: string | null, y: string | null) => y ?? x,
			default: () => null,
		},
		lastRoute: {
			value: (x: string | null, y: string | null) => (y == null ? x : y),
			default: () => null,
		},
	},
});

workflow.addNode('orchestrator', orchestrator);
workflow.addNode('analyticsAgent', analyticsAgent);
workflow.addNode('marketAgent', marketAgent);
workflow.addNode('weatherAgent', weatherAgent);
workflow.addNode('cropAgent', cropAgent);
workflow.addNode('fieldAgent', fieldAgent);
workflow.addNode('operationsAgent', operationsAgent);
workflow.addNode('financeAgent', financeAgent);
workflow.addNode('complianceAgent', complianceAgent);
workflow.addNode('sustainabilityAgent', sustainabilityAgent);
workflow.addNode('newsAgent', newsAgent);
workflow.addNode('academyAgent', academyAgent);
workflow.addNode('generalAgent', generalAgent);

// @ts-expect-error LangGraph typings vary by version
workflow.addEdge(START, 'orchestrator');
// @ts-expect-error LangGraph typings vary by version
workflow.addConditionalEdges('orchestrator', routeQuery);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('analyticsAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('marketAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('weatherAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('cropAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('fieldAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('operationsAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('financeAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('complianceAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('sustainabilityAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('newsAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('academyAgent', END);
// @ts-expect-error LangGraph typings vary by version
workflow.addEdge('generalAgent', END);

const checkpointer = new MemorySaver();
const app = workflow.compile({ checkpointer });

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const ip = clientIpFromVercelRequest(req);
	const max = Number(process.env.AGN_MESH_RATE_LIMIT_PER_MIN ?? '40') || 40;
	if (!checkRateLimit(`mesh:${ip}`, max, 60_000)) {
		logJson('rate_limited', { ip });
		return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
	}

	try {
		const body =
			typeof req.body === 'string' && req.body.length > 0
				? (JSON.parse(req.body) as Record<string, unknown>)
				: (req.body as Record<string, unknown> | undefined) ?? {};
		const message = typeof body.message === 'string' ? body.message : '';
		const farmContext = Array.isArray(body.farmContext) ? body.farmContext : [];
		const sessionId = typeof body.sessionId === 'string' ? body.sessionId : 'default_session';

		if (!message) {
			return res.status(400).json({ error: 'Message is required' });
		}

		if (!process.env.MISTRAL_API_KEY) {
			return res.status(500).json({
				error:
					'Missing MISTRAL_API_KEY in environment variables. Please add it to your Vercel project or .env file.',
			});
		}

		const t0 = Date.now();
		let contextString = '';
		if (farmContext.length > 0) {
			const fieldsList = farmContext
				.map((f: { hectares?: unknown; crop?: unknown; name?: unknown }) => {
					const ha = typeof f.hectares === 'number' ? f.hectares : '';
					const crop = typeof f.crop === 'string' ? f.crop : '';
					const name = typeof f.name === 'string' ? f.name : '';
					return `${ha}ha of ${crop} (${name})`;
				})
				.join(', ');
			contextString = `\n\nIMPORTANT USER CONTEXT:\nThe user currently has the following fields registered: ${fieldsList}. Use this for personalization when relevant. Do not say you were given hidden context.`;
		}

		const config = { configurable: { thread_id: sessionId } };
		const enrichedMessage = message + contextString;
		const result = (await app.invoke(
			{ messages: [new HumanMessage(enrichedMessage)] },
			config,
		)) as unknown as AgentState;

		const handledBy = result.lastRoute || (result.currentTask === 'DONE' ? 'mesh_complete' : (result.currentTask ?? 'unknown'));
		logJson('mesh_invoke_ok', { sessionId, handledBy, ms: Date.now() - t0 });

		return res.status(200).json({
			response: result.agentResponse,
			handledBy,
			lastRoute: result.lastRoute,
		});
	} catch (error) {
		logJson('mesh_invoke_error', { err: error instanceof Error ? error.message : String(error) });
		console.error('Error in Agent Mesh:', error);
		return res.status(500).json({ error: 'Internal server error processing the agent graph.' });
	}
}
