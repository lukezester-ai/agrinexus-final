import { FIELD_WATCH_OBLAST_PRESETS } from './field-watch-oblast-presets';
/** Споделена котва за област — Field Watch, метео, хранителна сигурност. */
export const OBLAST_ANCHOR_STORAGE_KEY = 'agrinexus-oblast-anchor-id';

const VALID_IDS = new Set(FIELD_WATCH_OBLAST_PRESETS.map(p => p.id));

export function readStoredOblastAnchorId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(OBLAST_ANCHOR_STORAGE_KEY)?.trim();
		if (!raw || !VALID_IDS.has(raw)) return null;
		return raw;
	} catch {
		return null;
	}
}

export function writeStoredOblastAnchorId(id: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (!VALID_IDS.has(id)) return;
		localStorage.setItem(OBLAST_ANCHOR_STORAGE_KEY, id);
	} catch {
		/* ignore */
	}
}

export function isValidOblastAnchorId(id: string): boolean {
	return VALID_IDS.has(id);
}
