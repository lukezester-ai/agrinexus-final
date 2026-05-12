/**
 * Сървърна конфигурация: бързите въпроси за млад фермер подават `ragPromptId` към /api/chat.
 * Не се доверяваме на произволен текст от клиента — само whitelist по id.
 */
export type AssistantRagRetrievalHints = {
	/** Добавя се към embedding заявката (не към видимото съобщение), за да приближим retrieval към релевантни чънкове. */
	embedAugment: string;
	/** Приоритет на редове с тези `topic_id` в индекса (виж seed-rag-known-docs). null = без пренареждане. */
	topicIds: string[] | null;
};

const MAP: Record<string, AssistantRagRetrievalHints> = {
	'yf-cap-entry': {
		embedAugment:
			'ISUN IACS single application unified request EFA deadlines SAPS Bulgaria CAP e-application campaign eumis',
		topicIds: ['subsidies', 'law_norm'],
	},
	'yf-logs-dafs': {
		embedAugment:
			'DAFS farm register spray diary fertiliser log plant protection record keeping agricultural documentation Bulgaria',
		topicIds: ['subsidies', 'phytosanitary'],
	},
	'yf-direct-min-area': {
		embedAugment:
			'minimum agricultural area direct payments eligibility GAEC greening Bulgaria DAFS',
		topicIds: ['subsidies', 'law_norm'],
	},
	'yf-young-farmer': {
		embedAugment:
			'young farmer payment measure PRDP rural development investment business plan Bulgaria',
		topicIds: ['subsidies'],
	},
	'yf-cross-compliance': {
		embedAugment:
			'cross compliance GAEC SMR statutory management requirements sanctions conditionality CAP Bulgaria',
		topicIds: ['subsidies', 'law_norm'],
	},
	'yf-first-year-field': {
		embedAugment:
			'crop rotation IPM integrated pest management first season new land plant protection BABH',
		topicIds: ['phytosanitary', 'organic', 'subsidies'],
	},
	'yf-margin-subsidy': {
		embedAugment:
			'farm margin subsidies fixed costs scheme payment calculation ROI direct payments Bulgaria',
		topicIds: ['subsidies'],
	},
	'yf-risk-small': {
		embedAugment:
			'crop insurance climate risk agricultural mutual fund price risk small producer Bulgaria',
		topicIds: ['subsidies', 'trade_export'],
	},
	'yf-official-sources': {
		embedAugment:
			'DAFS official schemes measures deadlines regional directorate Ministry agriculture Bulgaria',
		topicIds: ['subsidies', 'law_norm'],
	},
	'yf-quality-export': {
		embedAugment:
			'export phytosanitary certificate quality documentation customs trade small volume Bulgaria EU',
		topicIds: ['trade_export', 'phytosanitary'],
	},
};

export const ASSISTANT_RAG_PROMPT_IDS = Object.freeze(Object.keys(MAP)) as readonly string[];

export function resolveAssistantRagRetrieval(
	raw: unknown,
): AssistantRagRetrievalHints | null {
	if (typeof raw !== 'string') return null;
	const id = raw.trim();
	if (!id || !(id in MAP)) return null;
	return MAP[id] ?? null;
}
