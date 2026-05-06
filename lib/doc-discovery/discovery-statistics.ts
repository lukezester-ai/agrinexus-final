import type { DiscoveredDocLink, DiscoveryStatisticsV1 } from './types.js';

const MAX_RECENT_RUNS = 22;

export function appendDiscoveryRunStatistics(
	prev: DiscoveryStatisticsV1 | undefined,
	args: {
		at: string;
		discovered: DiscoveredDocLink[];
		sourcesAttempted: number;
		sourcesSkippedCooldown: number;
		attemptSources: Set<string>;
		fetchFailSources: Set<string>;
		cooldownSkipSources: Set<string>;
	},
): DiscoveryStatisticsV1 {
	const byTopic: Record<string, number> = {};
	const bySource: Record<string, number> = {};
	for (const d of args.discovered) {
		byTopic[d.topicId] = (byTopic[d.topicId] ?? 0) + 1;
		bySource[d.sourceId] = (bySource[d.sourceId] ?? 0) + 1;
	}

	const base: DiscoveryStatisticsV1 =
		prev?.version === 1
			? {
					version: 1,
					runCount: prev.runCount,
					cumulativeDiscoveries: prev.cumulativeDiscoveries,
					recentRuns: [...prev.recentRuns],
					topicTotals: { ...prev.topicTotals },
					sourceTotals: { ...prev.sourceTotals },
				}
			: {
					version: 1,
					runCount: 0,
					cumulativeDiscoveries: 0,
					recentRuns: [],
					topicTotals: {},
					sourceTotals: {},
				};

	base.runCount += 1;
	base.cumulativeDiscoveries += args.discovered.length;

	base.recentRuns.push({
		at: args.at,
		discovered: args.discovered.length,
		byTopic,
		bySource,
		sourcesAttempted: args.sourcesAttempted,
		sourcesSkippedCooldown: args.sourcesSkippedCooldown,
		fetchFailures: args.fetchFailSources.size,
	});
	base.recentRuns = base.recentRuns.slice(-MAX_RECENT_RUNS);

	for (const [tid, c] of Object.entries(byTopic)) {
		const row = base.topicTotals[tid] ?? { discoveries: 0, runsWithHits: 0 };
		row.discoveries += c;
		if (c > 0) row.runsWithHits += 1;
		base.topicTotals[tid] = row;
	}

	const bumpRow = (sid: string) =>
		base.sourceTotals[sid] ?? { discoveries: 0, attempts: 0, failures: 0, cooldownSkips: 0 };

	for (const sid of args.attemptSources) {
		const row = bumpRow(sid);
		row.attempts += 1;
		base.sourceTotals[sid] = row;
	}
	for (const sid of args.fetchFailSources) {
		const row = bumpRow(sid);
		row.failures += 1;
		base.sourceTotals[sid] = row;
	}
	for (const sid of args.cooldownSkipSources) {
		const row = bumpRow(sid);
		row.cooldownSkips += 1;
		base.sourceTotals[sid] = row;
	}
	for (const d of args.discovered) {
		const row = bumpRow(d.sourceId);
		row.discoveries += 1;
		base.sourceTotals[d.sourceId] = row;
	}

	return base;
}

export function compactStatisticsForLlm(s: DiscoveryStatisticsV1 | undefined): Record<string, unknown> {
	if (!s || s.version !== 1) return {};
	const topTopics = Object.entries(s.topicTotals)
		.sort((a, b) => (b[1]?.discoveries ?? 0) - (a[1]?.discoveries ?? 0))
		.slice(0, 10)
		.map(([id, v]) => ({ id, ...v }));
	const topSources = Object.entries(s.sourceTotals)
		.sort((a, b) => (b[1]?.discoveries ?? 0) - (a[1]?.discoveries ?? 0))
		.slice(0, 12)
		.map(([id, v]) => ({ id, ...v }));
	return {
		runCount: s.runCount,
		cumulativeDiscoveries: s.cumulativeDiscoveries,
		lastRuns: s.recentRuns.slice(-6),
		topTopics,
		topSources,
	};
}
