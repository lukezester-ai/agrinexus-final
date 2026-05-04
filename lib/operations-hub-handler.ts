import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizePersistedBody, type OpsHubPersistedV1 } from './operations-hub-types';

const FILE = join(process.cwd(), '.local', 'operations-hub-state.json');

async function readStateFile(): Promise<OpsHubPersistedV1 | null> {
	try {
		const raw = await readFile(FILE, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizePersistedBody(parsed);
	} catch {
		return null;
	}
}

async function writeStateFile(state: OpsHubPersistedV1): Promise<void> {
	await mkdir(join(process.cwd(), '.local'), { recursive: true });
	await writeFile(FILE, JSON.stringify(state, null, 2), 'utf8');
}

export async function handleOperationsHubGet(): Promise<{
	ok: true;
	state: OpsHubPersistedV1 | null;
}> {
	const state = await readStateFile();
	return { ok: true, state };
}

/**
 * Last-write-wins by ISO timestamp: reject stale POST with conflict + current server state.
 */
export async function handleOperationsHubPost(
	rawBody: unknown
): Promise<
	| { ok: true; state: OpsHubPersistedV1 }
	| { ok: false; status: number; error: string }
	| { ok: true; conflict: true; state: OpsHubPersistedV1 }
> {
	const incoming = normalizePersistedBody(rawBody);
	if (!incoming) {
		return { ok: false, status: 400, error: 'Invalid operations hub payload' };
	}

	try {
		const stored = await readStateFile();
		if (!stored) {
			await writeStateFile(incoming);
			return { ok: true, state: incoming };
		}

		const tIn = Date.parse(incoming.updatedAt);
		const tSt = Date.parse(stored.updatedAt);
		if (Number.isNaN(tIn)) {
			return { ok: false, status: 400, error: 'Invalid updatedAt' };
		}
		if (!Number.isNaN(tSt) && tSt > tIn) {
			return { ok: true, conflict: true, state: stored };
		}

		await writeStateFile(incoming);
		return { ok: true, state: incoming };
	} catch {
		return { ok: false, status: 503, error: 'Operations hub storage unavailable' };
	}
}
