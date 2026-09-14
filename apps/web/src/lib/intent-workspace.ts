import { createClient } from "@/lib/supabase-server";
import type { BusinessIntent } from "@/lib/business-intents";

export async function loadIntentWorkspace(id: string) {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return null;
	const { data: intent } = await supabase.from("business_intents").select("*").eq("id", id).maybeSingle();
	if (!intent) return null;
	const [{ data: membership }, { data: secret }, { data: matches }, { data: audit }] = await Promise.all([
		supabase.from("organization_memberships").select("role").eq("organization_id", intent.organization_id).eq("user_id", user.id).maybeSingle(),
		supabase.from("business_intent_secrets").select("private_brief").eq("intent_id", id).maybeSingle(),
		supabase.from("business_matches").select("id,lifecycle,score,opportunity_id,created_at").eq("intent_id", id).order("score", { ascending: false }),
		supabase.from("organization_audit_log").select("id,action,details,created_at").eq("subject_id", id).order("created_at", { ascending: false }),
	]);
	const role = membership?.role as string | undefined;
	const canManage = role === "owner" || role === "admin" || (role === "member" && intent.created_by === user.id);
	return { intent: intent as BusinessIntent, canManage, privateBrief: secret?.private_brief as string | null ?? null, matches: matches ?? [], audit: audit ?? [] };
}
