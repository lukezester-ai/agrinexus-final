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
};
