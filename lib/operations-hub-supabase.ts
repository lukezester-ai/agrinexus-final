import { getSupabaseBrowserClient } from './infra/supabase-browser';
import { normalizePersistedBody, type OpsHubPersistedV1 } from './operations-hub-types';

const TABLE = 'operations_hub_workspace';

export async function fetchOpsHubFromSupabase(userId: string): Promise<OpsHubPersistedV1 | null> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return null;
	const { data, error } = await sb.from(TABLE).select('body').eq('user_id', userId).maybeSingle();
	if (error || data == null || data.body == null) return null;
	return normalizePersistedBody(data.body as unknown);
}

export type OpsHubCloudPushResult =
	| { ok: true }
	| { ok: false; conflict: true; serverState: OpsHubPersistedV1 }
	| { ok: false; error: string };

/**
 * Optimistic concurrency using `body.updatedAt` — older writes lose and receive current server body.
 */
export async function upsertOpsHubToSupabase(
	userId: string,
	incoming: OpsHubPersistedV1,
): Promise<OpsHubCloudPushResult> {
	const sb = getSupabaseBrowserClient();
	if (!sb) return { ok: false, error: 'Supabase client not configured' };

	const existing = await fetchOpsHubFromSupabase(userId);
	if (existing) {
		const te = Date.parse(existing.updatedAt);
		const ti = Date.parse(incoming.updatedAt);
		if (!Number.isNaN(te) && !Number.isNaN(ti) && te > ti) {
			return { ok: false, conflict: true, serverState: existing };
		}
	}

	const { error } = await sb.from(TABLE).upsert(
		{
			user_id: userId,
			body: incoming as never,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'user_id' },
	);

	if (error) return { ok: false, error: error.message };
	return { ok: true };
}
