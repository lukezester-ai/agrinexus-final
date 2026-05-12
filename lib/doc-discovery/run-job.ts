import { DISCOVERY_SOURCES, DISCOVERY_TOPICS, mergeDiscoverySources } from './topics-and-sources.js';

import {

	extractDocumentLinksFromHtml,

	fetchHtmlPage,

	rankSecondaryHtmlPageUrls,

} from './crawler.js';

import {

	boostKeywordWeightsForTopicKeys,

	bumpKeywordWeightsFromDiscoveries,

	decayKeywordWeights,

	ensureWeightsForExtraKeywords,

	learnKeywordsFromDiscoveries,

	scoreLinkDetailed,

	topWeightedKeywordsPreview,

	tuneSourcePriority,

	tuneTopicMinScore,

} from './score-and-learn.js';

import {

	afterFetchFailure,

	afterSuccessfulYield,

	afterZeroYield,

	clearExpiredCooldown,

	defaultSourceHealth,

	isSourceInCooldown,

	normalizeSourceHealth,

} from './source-health.js';

import { defaultDiscoveryState, loadDiscoveryState, saveDiscoveryState } from './state.js';

import type { DiscoveredDocLink, DocDiscoveryJobResult } from './types.js';
import { indexDiscoveriesForMl } from './ml-index.js';
import { appendDiscoveryRunStatistics } from './discovery-statistics.js';
import { augmentLearnedKeywordsWithLlm } from './llm-learn.js';
import { generateDiscoveryInsightsWithLlm } from './llm-stats-insights.js';
import { mergeAndCapDynamicSources, proposeDiscoverySourcesWithLlm } from './llm-propose-sources.js';
import { isAnyLlmConfigured } from '../llm-routing.js';



function parsePositiveInt(raw: string | undefined, fallback: number): number {

	const n = Number(String(raw ?? '').trim());

	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;

}



function parsePositiveFloat(raw: string | undefined, fallback: number): number {

	const n = Number(String(raw ?? '').trim());

	return Number.isFinite(n) && n > 0 ? n : fallback;

}



/** Забележка за часа: Vercel Cron е в UTC — виж `vercel.json` и `.env.example` */

export function cronScheduleNoteBg(): string {

	const hourUtc = process.env.DOC_DISCOVERY_CRON_HOUR_UTC?.trim();

	if (hourUtc && /^\d{1,2}$/.test(hourUtc)) {

		return `Планирано пускане по проект: всеки ден в ${hourUtc}:00 UTC (провери vercel.json → crons).`;

	}

	return 'Планирано пускане: виж `vercel.json` → crons (часовете са UTC). За София добави +2/+3 ч през лятно часово време.';

}



export async function runDocDiscoveryJob(): Promise<DocDiscoveryJobResult> {

	const runAt = new Date().toISOString();

	const nowMs = Date.now();

	const maxPerPage = parsePositiveInt(process.env.DOC_DISCOVERY_MAX_LINKS_PER_PAGE, 24);

	const fetchTimeoutMs = parsePositiveInt(process.env.DOC_DISCOVERY_FETCH_TIMEOUT_MS, 14000);

	const maxLearnPerTopic = parsePositiveInt(process.env.DOC_DISCOVERY_MAX_LEARNED_KEYWORDS_PER_TOPIC, 48);

	const secondaryPagesMax = parsePositiveInt(process.env.DOC_DISCOVERY_SECONDARY_PAGES_MAX, 3);



	const weightDecayFactor = parsePositiveFloat(process.env.DOC_DISCOVERY_WEIGHT_DECAY_FACTOR, 0.988);

	const weightFloor = parsePositiveFloat(process.env.DOC_DISCOVERY_WEIGHT_FLOOR, 0.35);

	const weightBump = parsePositiveFloat(process.env.DOC_DISCOVERY_WEIGHT_BUMP, 0.45);

	const maxWeightKeysPerTopic = parsePositiveInt(process.env.DOC_DISCOVERY_MAX_WEIGHT_KEYS_PER_TOPIC, 96);

	const previewLimit = parsePositiveInt(process.env.DOC_DISCOVERY_LEARNING_PREVIEW_LIMIT, 8);



	const failStreakThreshold = parsePositiveInt(process.env.DOC_DISCOVERY_FETCH_FAIL_STREAK, 2);

	const failCooldownHours = parsePositiveFloat(process.env.DOC_DISCOVERY_FETCH_FAIL_COOLDOWN_HOURS, 24);

	const zeroYieldStreakThreshold = parsePositiveInt(process.env.DOC_DISCOVERY_ZERO_YIELD_STREAK, 3);

	const zeroYieldCooldownHours = parsePositiveFloat(process.env.DOC_DISCOVERY_ZERO_YIELD_COOLDOWN_HOURS, 48);



	const loaded = await loadDiscoveryState();

	const baseState = loaded.version === 1 ? loaded : defaultDiscoveryState();



	const topicIds = DISCOVERY_TOPICS.map(t => t.id);

	let topicWeights = decayKeywordWeights(

		baseState.topicKeywordWeights,

		topicIds,

		Math.min(0.999, Math.max(0.85, weightDecayFactor)),

		Math.min(0.9, Math.max(0.15, weightFloor)),

	);



	const discovered: DiscoveredDocLink[] = [];

	const mergedSourcesList = mergeDiscoverySources(DISCOVERY_SOURCES, baseState.dynamicSources);

	const sourceIds = mergedSourcesList.map(s => s.id);

	const statsAttemptSources = new Set<string>();

	const statsFetchFailSources = new Set<string>();

	const statsCooldownSkipSources = new Set<string>();

	let nextInsights = baseState.discoveryInsights;

	let finalDynamicSources = [...(baseState.dynamicSources ?? [])];

	const llmSourcesResult: DocDiscoveryJobResult['llmSources'] = {

		enabled: process.env.DOC_DISCOVERY_LLM_SOURCES === '1',

		attempted: false,

		added: 0,

		totalDynamic: finalDynamicSources.length,

	};

	const nextHealth = normalizeSourceHealth(baseState.sourceHealth, sourceIds);

	for (const id of sourceIds) {

		nextHealth[id] = clearExpiredCooldown(nextHealth[id] ?? defaultSourceHealth(), nowMs);

	}



	let sourcesFetchAttempted = 0;

	let sourcesSkippedCooldown = 0;

	let secondaryPagesFetchedTotal = 0;

	const sourceRunNotes: Record<string, string> = {};

	const enteredCooldownThisRun = new Set<string>();



	const sortedSources = [...mergedSourcesList].sort(

		(a, b) => (baseState.sourcePriority[b.id] ?? 1) - (baseState.sourcePriority[a.id] ?? 1),

	);



	for (const src of sortedSources) {

		const h = clearExpiredCooldown(nextHealth[src.id] ?? defaultSourceHealth(), nowMs);



		if (isSourceInCooldown(h, nowMs)) {

			sourcesSkippedCooldown += 1;

			statsCooldownSkipSources.add(src.id);

			sourceRunNotes[src.id] =

				h.cooldownUntilISO !== undefined

					? `пропуск — cooldown до ${h.cooldownUntilISO}`

					: 'пропуск — cooldown';

			continue;

		}



		sourcesFetchAttempted += 1;

		statsAttemptSources.add(src.id);

		const html = await fetchHtmlPage(src.indexUrl, fetchTimeoutMs);

		if (!html) {

			statsFetchFailSources.add(src.id);

			const r = afterFetchFailure(h, failStreakThreshold, failCooldownHours, nowMs);

			nextHealth[src.id] = r.next;

			sourceRunNotes[src.id] = r.enteredCooldown

				? `HTTP грешка — пауза до ${r.next.cooldownUntilISO ?? '—'}`

				: `неуспешно изтегляне (${r.next.fetchFailStreak}/${failStreakThreshold})`;

			if (r.enteredCooldown) enteredCooldownThisRun.add(src.id);

			continue;

		}



		const priority = Math.max(1, Math.min(5, baseState.sourcePriority[src.id] ?? 1));

		const sourceLimit = Math.min(80, maxPerPage + (priority - 1) * 6);

		const linkBudget = Math.min(140, sourceLimit * 3);



		const htmlPairs: { h: string; base: string }[] = [{ h: html, base: src.indexUrl }];

		let secondaryFetchedForSource = 0;

		if (secondaryPagesMax > 0) {

			const ranked = rankSecondaryHtmlPageUrls(html, src.indexUrl, secondaryPagesMax * 4).slice(

				0,

				secondaryPagesMax,

			);

			for (const u of ranked) {

				const inner = await fetchHtmlPage(u, fetchTimeoutMs);

				if (inner) {

					secondaryPagesFetchedTotal += 1;

					secondaryFetchedForSource += 1;

					htmlPairs.push({ h: inner, base: u });

				}

			}

		}



		const seenUrls = new Set<string>();

		const links: { url: string; title: string }[] = [];

		for (const { h, base } of htmlPairs) {

			for (const L of extractDocumentLinksFromHtml(h, base, linkBudget)) {

				if (seenUrls.has(L.url)) continue;

				seenUrls.add(L.url);

				links.push(L);

				if (links.length >= linkBudget) break;

			}

			if (links.length >= linkBudget) break;

		}



		let added = 0;

		for (const link of links) {

			const blob = `${link.url} ${link.title}`.toLowerCase();

			let bestTopicId = '';

			let bestScore = 0;

			let bestExtras: string[] = [];



			for (const topic of DISCOVERY_TOPICS) {

				const extra = baseState.topicExtraKeywords[topic.id] ?? [];

				const wrow = topicWeights[topic.id] ?? {};

				const { score, matchedExtras } = scoreLinkDetailed(blob, topic, extra, wrow);

				if (score > bestScore) {

					bestScore = score;

					bestTopicId = topic.id;

					bestExtras = matchedExtras;

				}

			}



			if (!bestTopicId) continue;

			const dynamicMinScore = baseState.topicMinScore[bestTopicId] ?? 4;

			if (bestScore < dynamicMinScore) continue;



			discovered.push({

				url: link.url,

				title: link.title,

				sourceId: src.id,

				topicId: bestTopicId,

				score: bestScore,

				matchedExtras: bestExtras.length > 0 ? bestExtras : undefined,

			});

			added += 1;

		}



		if (added > 0) {

			nextHealth[src.id] = afterSuccessfulYield();

			const secNote =

				secondaryFetchedForSource > 0

					? ` (+${secondaryFetchedForSource} спомагателни HTML страници)`

					: '';

			sourceRunNotes[src.id] = `OK — ${added} релевантни${secNote}`;

		} else {

			const r = afterZeroYield(h, zeroYieldStreakThreshold, zeroYieldCooldownHours, nowMs);

			nextHealth[src.id] = r.next;

			sourceRunNotes[src.id] = r.enteredCooldown

				? `няма релевантни — пауза до ${r.next.cooldownUntilISO ?? '—'}`

				: `няма релевантни (${r.next.zeroYieldStreak}/${zeroYieldStreakThreshold})`;

			if (r.enteredCooldown) enteredCooldownThisRun.add(src.id);

		}

	}



	const discoveryStatistics = appendDiscoveryRunStatistics(baseState.discoveryStatistics, {

		at: runAt,

		discovered,

		sourcesAttempted: sourcesFetchAttempted,

		sourcesSkippedCooldown,

		attemptSources: statsAttemptSources,

		fetchFailSources: statsFetchFailSources,

		cooldownSkipSources: statsCooldownSkipSources,

	});

	const insightsEnabled = process.env.DOC_DISCOVERY_LLM_STATS_INSIGHTS === '1';

	if (insightsEnabled && isAnyLlmConfigured()) {

		const ins = await generateDiscoveryInsightsWithLlm({

			statistics: discoveryStatistics,

			topics: DISCOVERY_TOPICS,

			discoveredSample: discovered,

			runAtISO: runAt,

		});

		if (ins.summaryBg || ins.predictionsBg) {

			nextInsights = {

				at: runAt,

				summaryBg: ins.summaryBg,

				predictionsBg: ins.predictionsBg,

				model: ins.model,

				...(ins.error ? { error: ins.error } : {}),

			};

		}

	}

	if (llmSourcesResult.enabled && isAnyLlmConfigured()) {

		llmSourcesResult.attempted = true;

		const maxDynamic = parsePositiveInt(process.env.DOC_DISCOVERY_MAX_DYNAMIC_SOURCES, 28);

		const maxPerRun = parsePositiveInt(process.env.DOC_DISCOVERY_LLM_MAX_SOURCES_PER_RUN, 5);

		const pr = await proposeDiscoverySourcesWithLlm({

			topics: DISCOVERY_TOPICS,

			existingStaticUrls: DISCOVERY_SOURCES.map(s => s.indexUrl),

			existingDynamic: finalDynamicSources,

			discovered,

			statistics: discoveryStatistics,

			maxNewThisRun: maxPerRun,

			runAtISO: runAt,

		});

		llmSourcesResult.model = pr.model;

		if (pr.error) llmSourcesResult.error = pr.error;

		finalDynamicSources = mergeAndCapDynamicSources(finalDynamicSources, pr.added, maxDynamic);

		llmSourcesResult.added = pr.addedCount;

		llmSourcesResult.totalDynamic = finalDynamicSources.length;

	}

	let mergedExtraKeywords = learnKeywordsFromDiscoveries(

		discovered,

		DISCOVERY_TOPICS,

		baseState.topicExtraKeywords,

		maxLearnPerTopic,

	);

	const llmLearnEnabled = process.env.DOC_DISCOVERY_LLM_LEARN === '1';

	const llmMaxAddPerTopic = parsePositiveInt(process.env.DOC_DISCOVERY_LLM_MAX_KEYWORDS_PER_TOPIC, 12);

	const llmKeywordBoot = parsePositiveFloat(process.env.DOC_DISCOVERY_LLM_KEYWORD_BOOT, 1.22);

	const llmLearn: NonNullable<DocDiscoveryJobResult['llmLearn']> = {

		enabled: llmLearnEnabled,

		attempted: false,

		addedKeywords: 0,

	};

	let llmAddedByTopic: Record<string, string[]> = {};

	if (llmLearnEnabled && isAnyLlmConfigured()) {

		llmLearn.attempted = true;

		const lr = await augmentLearnedKeywordsWithLlm({

			topics: DISCOVERY_TOPICS,

			discovered,

			currentExtraByTopic: mergedExtraKeywords,

			maxAddPerTopic: llmMaxAddPerTopic,

		});

		llmLearn.model = lr.model;

		if (lr.error) llmLearn.error = lr.error;

		mergedExtraKeywords = lr.merged;

		llmAddedByTopic = lr.addedByTopic;

		llmLearn.addedKeywords = Object.values(lr.addedByTopic).reduce((s, a) => s + a.length, 0);

	}

	const bumped = bumpKeywordWeightsFromDiscoveries(

		discovered,

		topicWeights,

		weightBump,

		maxWeightKeysPerTopic,

		weightFloor,

	);

	topicWeights = ensureWeightsForExtraKeywords(

		mergedExtraKeywords,

		bumped.next,

		maxWeightKeysPerTopic,

		weightFloor,

	);

	if (llmLearn.addedKeywords > 0) {

		topicWeights = boostKeywordWeightsForTopicKeys(

			topicWeights,

			llmAddedByTopic,

			llmKeywordBoot,

			maxWeightKeysPerTopic,

			weightFloor,

		);

	}



	const nextTopicMinScore = tuneTopicMinScore(

		DISCOVERY_TOPICS,

		discovered,

		baseState.topicMinScore,

	);

	const nextSourcePriority = tuneSourcePriority(

		sourceIds,

		discovered,

		baseState.sourcePriority,

	);

	for (const id of enteredCooldownThisRun) {

		nextSourcePriority[id] = Math.max(1, (nextSourcePriority[id] ?? 1) - 1);

	}



	const topicsTouched = [...new Set(discovered.map(d => d.topicId))].filter(Boolean);

	const countsByTopic: Record<string, number> = {};

	const countsBySource: Record<string, number> = {};

	for (const d of discovered) {

		countsByTopic[d.topicId] = (countsByTopic[d.topicId] ?? 0) + 1;

		countsBySource[d.sourceId] = (countsBySource[d.sourceId] ?? 0) + 1;

	}



	const lastRunSummary = {

		at: runAt,

		countsByTopic,

		countsBySource,

		secondaryPagesFetched: secondaryPagesFetchedTotal,

		keywordWeightBumps: bumped.bumpsApplied,

	};



	const nextState = {

		version: 1 as const,

		topicExtraKeywords: mergedExtraKeywords,

		topicMinScore: nextTopicMinScore,

		sourcePriority: nextSourcePriority,

		sourceHealth: nextHealth,

		topicKeywordWeights: topicWeights,

		lastRunSummary,

		runLog: [

			...baseState.runLog,

			{ at: runAt, discovered: discovered.length, topicsTouched },

		],

		dynamicSources: finalDynamicSources,

		discoveryStatistics,

		...(nextInsights ? { discoveryInsights: nextInsights } : {}),

	};



	const saveRes = await saveDiscoveryState(nextState);

	const persisted = saveRes.ok;



	const learningSummary = {

		secondaryPagesFetched: secondaryPagesFetchedTotal,

		keywordWeightBumps: bumped.bumpsApplied,

		topWeightedKeywords: topWeightedKeywordsPreview(topicWeights, topicIds, previewLimit),

	};

	const mlEnabled = process.env.DOC_DISCOVERY_ML_INDEX === '1';

	const mlMaxDocs = parsePositiveInt(process.env.DOC_DISCOVERY_ML_MAX_DOCS_PER_RUN, 30);

	let mlIndex: NonNullable<DocDiscoveryJobResult['mlIndex']>;

	if (!mlEnabled) {

		mlIndex = { enabled: false, indexed: 0 };

	} else {

		const r = await indexDiscoveriesForMl(discovered, mlMaxDocs);

		mlIndex = {

			enabled: true,

			indexed: r.indexed,

			model: r.model,

			...(r.error ? { error: r.error } : {}),

		};

	}



	return {

		ok: true,

		runAt,

		scheduleNote: cronScheduleNoteBg(),

		sourcesScanned: mergedSourcesList.length,

		discovered,

		persisted,

		persistError: saveRes.error,

		selfLearnedKeywords: mergedExtraKeywords,

		llmLearn,

		llmSources: llmSourcesResult,

		discoveryStatistics,

		discoveryInsights: nextInsights,

		sourcesFetchAttempted,

		sourcesSkippedCooldown,

		sourceRunNotes,

		learningSummary,

		lastRunSummary,

		mlIndex,

	};

}


