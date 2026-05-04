import type { OpsHubPersistedV1 } from './operations-hub-types';
import { normalizePersistedBody } from './operations-hub-types';

export type OpsHubPushResult =
	| { ok: true; state: OpsHubPersistedV1 }
	| { ok: true; conflict: true; state: OpsHubPersistedV1 }
	| { ok: false; reason: 'network' | 'bad_response' };

/** Relative `/api` works with Vite proxy in dev and same-origin `/api` when deployed. */
export async function fetchOperationsHubRemote(): Promise<OpsHubPersistedV1 | null> {
	try {
		const res = await fetch('/api/operations-hub', { method: 'GET', credentials: 'omit' });
		if (!res.ok) return null;
		const data = (await res.json()) as { ok?: boolean; state?: unknown };
		if (!data || data.ok !== true || data.state == null) return null;
		return normalizePersistedBody(data.state);
	} catch {
		return null;
	}
}

export async function pushOperationsHubRemote(payload: OpsHubPersistedV1): Promise<OpsHubPushResult> {
	try {
		const res = await fetch('/api/operations-hub', {
			method: 'POST',
			credentials: 'omit',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(payload),
		});
		const data = (await res.json()) as {
			ok?: boolean;
			conflict?: boolean;
			state?: unknown;
			error?: string;
		};
		if (!data || typeof data !== 'object') return { ok: false, reason: 'bad_response' };
		const norm = data.state != null ? normalizePersistedBody(data.state) : null;
		if (!norm) return { ok: false, reason: 'bad_response' };
		if (data.ok === true && data.conflict === true) {
			return { ok: true, conflict: true, state: norm };
		}
		if (data.ok === true) {
			return { ok: true, state: norm };
		}
		return { ok: false, reason: 'bad_response' };
	} catch {
		return { ok: false, reason: 'network' };
	}
}
