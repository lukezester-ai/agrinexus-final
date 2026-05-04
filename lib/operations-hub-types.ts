export type OpsTaskColumn = 'todo' | 'doing' | 'done';

export type OpsTask = { id: string; title: string; column: OpsTaskColumn };

/** Persisted blob — tasks, notes, monotonic logical revision `updatedAt`. */
export type OpsHubPersistedV1 = {
	schemaVersion: 1;
	updatedAt: string;
	locale?: string;
	tasks: OpsTask[];
	notes: string;
};

export function parseTasks(raw: unknown): OpsTask[] {
	if (!Array.isArray(raw)) return [];
	const out: OpsTask[] = [];
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const id = (row as OpsTask).id;
		const title = (row as OpsTask).title;
		const column = (row as OpsTask).column;
		if (typeof id !== 'string' || typeof title !== 'string') continue;
		if (column !== 'todo' && column !== 'doing' && column !== 'done') continue;
		const t = title.trim().slice(0, 280);
		if (!t) continue;
		out.push({ id, title: t, column });
	}
	return out;
}

export function normalizePersistedBody(raw: unknown): OpsHubPersistedV1 | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const sv = o.schemaVersion;
	if (sv !== 1) return null;
	const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt.trim() : '';
	if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) return null;
	const notes = typeof o.notes === 'string' ? o.notes.slice(0, 8000) : '';
	const locale = typeof o.locale === 'string' ? o.locale.trim().slice(0, 8) : undefined;
	return {
		schemaVersion: 1,
		updatedAt,
		locale: locale || undefined,
		tasks: parseTasks(o.tasks),
		notes,
	};
}
