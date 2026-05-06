import { runDocDiscoveryJob } from './doc-discovery/run-job.js';

function bearerToken(authHeader: string | undefined): string | null {
	if (!authHeader || typeof authHeader !== 'string') return null;
	const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
	return m?.[1]?.trim() ?? null;
}

/** Vercel Cron изпраща `Authorization: Bearer` спрямо променливата `CRON_SECRET`; ръчно тестване — `DOC_DISCOVERY_CRON_SECRET`. */
export function verifyDocDiscoveryCronSecret(authHeader: string | undefined): boolean {
	const secrets = [
		process.env.DOC_DISCOVERY_CRON_SECRET?.trim(),
		process.env.CRON_SECRET?.trim(),
	].filter(Boolean) as string[];
	if (secrets.length === 0) return false;
	const tok = bearerToken(authHeader);
	return !!tok && secrets.includes(tok);
}

export async function handleDocDiscoveryCronRequest(opts: {
	method: string;
	authHeader: string | undefined;
}): Promise<{ status: number; body: Record<string, unknown> }> {
	if (opts.method !== 'GET' && opts.method !== 'POST') {
		return { status: 405, body: { ok: false, error: 'Method not allowed' } };
	}

	if (
		!process.env.DOC_DISCOVERY_CRON_SECRET?.trim() &&
		!process.env.CRON_SECRET?.trim()
	) {
		return {
			status: 503,
			body: {
				ok: false,
				error: 'Липсва secret за cron',
				hint: 'Задай DOC_DISCOVERY_CRON_SECRET в .env за ръчни тестове, или CRON_SECRET във Vercel (автоматично Bearer към cron).',
			},
		};
	}

	if (!verifyDocDiscoveryCronSecret(opts.authHeader)) {
		return {
			status: 401,
			body: { ok: false, error: 'Невалиден или липсващ Bearer token' },
		};
	}

	try {
		const result = await runDocDiscoveryJob();
		return {
			status: 200,
			body: {
				ok: true,
				runAt: result.runAt,
				scheduleNote: result.scheduleNote,
				sourcesScanned: result.sourcesScanned,
				sourcesFetchAttempted: result.sourcesFetchAttempted,
				sourcesSkippedCooldown: result.sourcesSkippedCooldown,
				sourceRunNotes: result.sourceRunNotes,
				discoveredCount: result.discovered.length,
				discovered: result.discovered.slice(0, 80),
				persisted: result.persisted,
				persistError: result.persistError,
				selfLearnedKeywords: result.selfLearnedKeywords,
				llmLearn: result.llmLearn,
				learningSummary: result.learningSummary,
				lastRunSummary: result.lastRunSummary,
				mlIndex: result.mlIndex,
			},
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Job failed';
		return { status: 500, body: { ok: false, error: msg } };
	}
}
