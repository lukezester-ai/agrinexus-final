import type { SourceHealthEntry } from './types.js';

export function defaultSourceHealth(): SourceHealthEntry {
	return { fetchFailStreak: 0, zeroYieldStreak: 0 };
}

export function normalizeSourceHealth(
	prev: Record<string, SourceHealthEntry> | undefined,
	sourceIds: string[],
): Record<string, SourceHealthEntry> {
	const out: Record<string, SourceHealthEntry> = {};
	for (const id of sourceIds) {
		const e = prev?.[id];
		out[id] = {
			fetchFailStreak: e?.fetchFailStreak ?? 0,
			zeroYieldStreak: e?.zeroYieldStreak ?? 0,
			cooldownUntilISO: typeof e?.cooldownUntilISO === 'string' ? e.cooldownUntilISO : undefined,
		};
	}
	return out;
}

/** Изчиства изтекъл cooldown преди решение за текущото пускане */
export function clearExpiredCooldown(entry: SourceHealthEntry, nowMs: number): SourceHealthEntry {
	if (!entry.cooldownUntilISO) return entry;
	const until = new Date(entry.cooldownUntilISO).getTime();
	if (until <= nowMs) return { ...entry, cooldownUntilISO: undefined };
	return entry;
}

export function isSourceInCooldown(entry: SourceHealthEntry, nowMs: number): boolean {
	if (!entry.cooldownUntilISO) return false;
	return new Date(entry.cooldownUntilISO).getTime() > nowMs;
}

export function afterSuccessfulYield(): SourceHealthEntry {
	return { fetchFailStreak: 0, zeroYieldStreak: 0, cooldownUntilISO: undefined };
}

export function afterFetchFailure(
	entry: SourceHealthEntry,
	failThreshold: number,
	cooldownHours: number,
	nowMs: number,
): { next: SourceHealthEntry; enteredCooldown: boolean } {
	const streak = entry.fetchFailStreak + 1;
	if (streak >= failThreshold) {
		const until = new Date(nowMs + cooldownHours * 3600e3).toISOString();
		return {
			next: { fetchFailStreak: 0, zeroYieldStreak: entry.zeroYieldStreak, cooldownUntilISO: until },
			enteredCooldown: true,
		};
	}
	return {
		next: { fetchFailStreak: streak, zeroYieldStreak: entry.zeroYieldStreak },
		enteredCooldown: false,
	};
}

export function afterZeroYield(
	entry: SourceHealthEntry,
	zeroThreshold: number,
	cooldownHours: number,
	nowMs: number,
): { next: SourceHealthEntry; enteredCooldown: boolean } {
	const streak = entry.zeroYieldStreak + 1;
	if (streak >= zeroThreshold) {
		const until = new Date(nowMs + cooldownHours * 3600e3).toISOString();
		return {
			next: { fetchFailStreak: 0, zeroYieldStreak: 0, cooldownUntilISO: until },
			enteredCooldown: true,
		};
	}
	return {
		next: { fetchFailStreak: 0, zeroYieldStreak: streak },
		enteredCooldown: false,
	};
}
