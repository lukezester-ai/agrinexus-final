import fs from 'node:fs';
import path from 'node:path';

/** Persisted when using local `data/visit-stats.json` (dev / VPS с диск). */
export type VisitStatsState = {
	version: 1;
	totalSessions: number;
	/** Анонимни UUID от браузъра → timestamp на първо виждане */
	visitors: Record<string, number>;
	updatedAt: string;
};

const MAX_VISITOR_KEYS = 80_000;
const SESSION_KEY_PREFIX = 'agrinexus:visit';

function statsFilePath(): string {
	const override = process.env.VISIT_STATS_FILE?.trim();
	if (override) return override;
	return path.join(process.cwd(), 'data', 'visit-stats.json');
}

function loadFileState(): VisitStatsState {
	const fp = statsFilePath();
	try {
		const raw = fs.readFileSync(fp, 'utf8');
		const parsed = JSON.parse(raw) as Partial<VisitStatsState>;
		if (
			parsed?.version === 1 &&
			typeof parsed.totalSessions === 'number' &&
			parsed.visitors &&
			typeof parsed.visitors === 'object'
		) {
			return {
				version: 1,
				totalSessions: parsed.totalSessions,
				visitors: parsed.visitors,
				updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
			};
		}
	} catch {
		/* missing or corrupt */
	}
	return {
		version: 1,
		totalSessions: 0,
		visitors: {},
		updatedAt: new Date().toISOString(),
	};
}

function saveFileState(state: VisitStatsState): void {
	const fp = statsFilePath();
	fs.mkdirSync(path.dirname(fp), { recursive: true });
	fs.writeFileSync(fp, JSON.stringify(state, null, 0), 'utf8');
}

function safeVisitorId(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const s = raw.trim().slice(0, 64);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))
		return null;
	return s.toLowerCase();
}

async function upstashPipeline(cmds: (string | number)[][]): Promise<unknown[]> {
	const base = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, '');
	const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
	if (!base || !token) throw new Error('Upstash not configured');

	const res = await fetch(`${base}/pipeline`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(cmds),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => '');
		throw new Error(`Upstash HTTP ${res.status}: ${t.slice(0, 200)}`);
	}
	const data = (await res.json()) as unknown;
	if (!Array.isArray(data)) {
		throw new Error('Unexpected Upstash pipeline response (expected JSON array)');
	}
	return data.map((item: unknown, i: number) => {
		if (item && typeof item === 'object' && 'error' in item) {
			const err = (item as { error: string }).error;
			throw new Error(`Upstash pipeline cmd ${i}: ${err}`);
		}
		if (item && typeof item === 'object' && 'result' in item) {
			return (item as { result: unknown }).result;
		}
		throw new Error(`Unexpected Upstash pipeline entry ${i}`);
	});
}

function hasUpstashRedisEnv(): boolean {
	return Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

export async function recordVisit(visitorId: string | null): Promise<{
	ok: true;
	totalSessions: number;
	uniqueVisitors: number;
	storage: 'upstash' | 'file' | 'none';
}> {
	if (hasUpstashRedisEnv()) {
		const sid = `${SESSION_KEY_PREFIX}:sessions`;
		const uniq = `${SESSION_KEY_PREFIX}:unique`;
		const results = visitorId
			? await upstashPipeline([
					['INCR', sid],
					['SADD', uniq, visitorId],
					['SCARD', uniq],
				])
			: await upstashPipeline([['INCR', sid], ['SCARD', uniq]]);
		const totalSessions = Number(results[0] ?? 0);
		const uniqueVisitors = Number(results[visitorId ? 2 : 1] ?? 0);
		return { ok: true, totalSessions, uniqueVisitors, storage: 'upstash' };
	}

	try {
		const state = loadFileState();
		state.totalSessions += 1;
		const keys = Object.keys(state.visitors);
		if (visitorId) {
			if (!(visitorId in state.visitors)) {
				if (keys.length < MAX_VISITOR_KEYS) {
					state.visitors[visitorId] = Date.now();
				}
			}
		}
		state.updatedAt = new Date().toISOString();
		saveFileState(state);
		return {
			ok: true,
			totalSessions: state.totalSessions,
			uniqueVisitors: Object.keys(state.visitors).length,
			storage: 'file',
		};
	} catch (e) {
		console.warn('[visit-stats] file storage failed:', e instanceof Error ? e.message : e);
		return { ok: true, totalSessions: 0, uniqueVisitors: 0, storage: 'none' };
	}
}

export async function readVisitStats(): Promise<{
	ok: true;
	totalSessions: number;
	uniqueVisitors: number;
	updatedAt: string | null;
	storage: 'upstash' | 'file' | 'none';
}> {
	if (hasUpstashRedisEnv()) {
		const sid = `${SESSION_KEY_PREFIX}:sessions`;
		const uniq = `${SESSION_KEY_PREFIX}:unique`;
		const results = await upstashPipeline([
			['GET', sid],
			['SCARD', uniq],
		]);
		const totalSessions = Number(results[0] ?? 0);
		const uniqueVisitors = Number(results[1] ?? 0);
		return {
			ok: true,
			totalSessions,
			uniqueVisitors,
			updatedAt: null,
			storage: 'upstash',
		};
	}

	try {
		const state = loadFileState();
		return {
			ok: true,
			totalSessions: state.totalSessions,
			uniqueVisitors: Object.keys(state.visitors).length,
			updatedAt: state.updatedAt,
			storage: 'file',
		};
	} catch {
		return { ok: true, totalSessions: 0, uniqueVisitors: 0, updatedAt: null, storage: 'none' };
	}
}

export function validateVisitStatsAuth(headerSecret: string | undefined): boolean {
	const expected = process.env.VISIT_STATS_SECRET?.trim();
	if (!expected) return true;
	if (!headerSecret) return false;
	const bearer = /^Bearer\s+(.+)$/i.exec(headerSecret);
	const token = bearer ? bearer[1].trim() : headerSecret.trim();
	return token === expected;
}

export async function handleVisitPost(rawBody: unknown): Promise<
	| { ok: true; totalSessions: number; uniqueVisitors: number; storage: string }
	| { ok: false; status: number; error: string }
> {
	const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};
	const visitorId = safeVisitorId(body.visitorId);
	try {
		const result = await recordVisit(visitorId);
		return {
			ok: true,
			totalSessions: result.totalSessions,
			uniqueVisitors: result.uniqueVisitors,
			storage: result.storage,
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Visit recording failed';
		return { ok: false, status: 503, error: msg };
	}
}

export async function handleVisitStatsGet(authHeader: string | undefined): Promise<
	| {
			ok: true;
			totalSessions: number;
			uniqueVisitors: number;
			updatedAt: string | null;
			storage: string;
	  }
	| { ok: false; status: number; error: string }
> {
	if (!validateVisitStatsAuth(authHeader)) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}
	try {
		const s = await readVisitStats();
		return {
			ok: true,
			totalSessions: s.totalSessions,
			uniqueVisitors: s.uniqueVisitors,
			updatedAt: s.updatedAt,
			storage: s.storage,
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Stats read failed';
		return { ok: false, status: 503, error: msg };
	}
}
