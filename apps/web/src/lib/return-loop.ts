import { createClient } from "@/lib/supabase-server";

export type ReturnLoopItem = {
	kind: string;
	id: string;
	updatedAt: string;
	title: string;
	summary: string | null;
	status: string | null;
	isUnread: boolean;
};

export async function loadReturnLoopItems(): Promise<{ items: ReturnLoopItem[]; error: string | null }> {
	const supabase = createClient();
	const { data, error } = await supabase.rpc("business_return_loop_items");
	if (error) return { items: [], error: error.message };
	return {
		items: (data ?? []).map((row: Record<string, unknown>) => ({
			kind: String(row.item_kind),
			id: String(row.item_id),
			updatedAt: String(row.item_updated_at),
			title: typeof row.safe_title === "string" ? row.safe_title : "Business match",
			summary: typeof row.safe_summary === "string" ? row.safe_summary : null,
			status: typeof row.status === "string" ? row.status : null,
			isUnread: row.is_unread === true,
		})),
		error: null,
	};
}
