export type DiscoveryTopic = {
	id: string;
	labelBg: string;
	/** Начални ключови думи за отсяване на релевантни файлове */
	seedKeywords: string[];
};

export type DiscoverySource = {
	id: string;
	labelBg: string;
	indexUrl: string;
};

export type DiscoveredDocLink = {
	url: string;
	title: string;
	sourceId: string;
	topicId: string;
	score: number;
	/** Ключови думи (learned/extra), които са съвпали — за претегляне при следващи обходи */
	matchedExtras?: string[];
};

/** Проследяване на нестабилни източници — автоматичен cooldown след поредни провали / нулев резултат */
export type SourceHealthEntry = {
	fetchFailStreak: number;
	zeroYieldStreak: number;
	cooldownUntilISO?: string;
};

/** Допълнителни начални страници, предложени от LLM или записани автоматично */
export type StoredDynamicSource = {
	id: string;
	labelBg: string;
	indexUrl: string;
	/** Насока към теми (не задължително филтър в обхода) */
	suggestedTopics?: string[];
	addedAt: string;
	provenance?: 'llm';
};

/** Натрупана статистика от нощните обходи */
export type DiscoveryStatisticsV1 = {
	version: 1;
	runCount: number;
	cumulativeDiscoveries: number;
	recentRuns: Array<{
		at: string;
		discovered: number;
		byTopic: Record<string, number>;
		bySource: Record<string, number>;
		sourcesAttempted: number;
		sourcesSkippedCooldown: number;
		fetchFailures: number;
	}>;
	topicTotals: Record<string, { discoveries: number; runsWithHits: number }>;
	sourceTotals: Record<
		string,
		{ discoveries: number; attempts: number; failures: number; cooldownSkips: number }
	>;
};

/** Кратък текстов извод + предположения от LLM върху статистиката */
export type DiscoveryInsightsV1 = {
	at: string;
	summaryBg: string;
	predictionsBg: string;
	model?: string;
	error?: string;
};

export type StoredDiscoveryStateV1 = {
	version: 1;
	/** Научени допълнителни ключови думи по тема (от заглавия на файлове) */
	topicExtraKeywords: Record<string, string[]>;
	/** Динамичен праг за тема (самоорганизация: по-строг/по-свободен филтър според последните резултати) */
	topicMinScore: Record<string, number>;
	/** Приоритет на източник (по-висок => сканира се по-рано и по-дълбоко) */
	sourcePriority: Record<string, number>;
	/** Cooldown и серии за авто-„пауза“ на проблемни индекси */
	sourceHealth: Record<string, SourceHealthEntry>;
	/** Тежести за научени ключови думи по тема (по-често уцелили → по-силен сигнал) */
	topicKeywordWeights: Record<string, Record<string, number>>;
	/** Обобщение от последното успешно завършено пускане */
	lastRunSummary?: {
		at: string;
		countsByTopic: Record<string, number>;
		countsBySource: Record<string, number>;
		secondaryPagesFetched: number;
		keywordWeightBumps: number;
	};
	/** Кратка история на последните пускания */
	runLog: Array<{ at: string; discovered: number; topicsTouched: string[] }>;
	/** LLM/системни допълнения към статичните seed източници */
	dynamicSources?: StoredDynamicSource[];
	/** Агрегирани метрики за трендове и последващ анализ */
	discoveryStatistics?: DiscoveryStatisticsV1;
	/** Последен текстов извод за оператори (BG) */
	discoveryInsights?: DiscoveryInsightsV1;
};

export type DocDiscoveryJobResult = {
	ok: true;
	runAt: string;
	scheduleNote: string;
	sourcesScanned: number;
	discovered: DiscoveredDocLink[];
	persisted: boolean;
	persistError?: string;
	selfLearnedKeywords: Record<string, string[]>;
	/** Колко източника реално са обходени (HTTP заявка), без пропуснати заради cooldown */
	sourcesFetchAttempted: number;
	/** Пропуснати заради активен cooldown */
	sourcesSkippedCooldown: number;
	/** Бележки по източници за последното пускане */
	sourceRunNotes: Record<string, string>;
	learningSummary?: {
		secondaryPagesFetched: number;
		keywordWeightBumps: number;
		topWeightedKeywords: Record<string, Array<{ keyword: string; weight: number }>>;
	};
	/** Запазено обобщение (същото като в payload след успешен save) */
	lastRunSummary?: StoredDiscoveryStateV1['lastRunSummary'];
	/** Семантично индексиране (embeddings → pgvector), ако е включено */
	mlIndex?: {
		enabled: boolean;
		indexed: number;
		model?: string;
		error?: string;
	};
	/** Допълнително самообучение на ключови думи през текстов LLM (Mistral/Ollama/OpenAI) */
	llmLearn?: {
		enabled: boolean;
		attempted: boolean;
		addedKeywords: number;
		model?: string;
		error?: string;
	};
	/** Нови начални източници от LLM */
	llmSources?: {
		enabled: boolean;
		attempted: boolean;
		added: number;
		totalDynamic: number;
		model?: string;
		error?: string;
	};
	/** Обобщена статистика след този run */
	discoveryStatistics?: DiscoveryStatisticsV1;
	/** Изводи от LLM върху статистиката */
	discoveryInsights?: DiscoveryInsightsV1;
};
