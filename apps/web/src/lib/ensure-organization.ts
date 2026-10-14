import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureUserOrganization(
	supabase: SupabaseClient,
	userId: string,
	fallbackName: string,
): Promise<{ organizationId: string; error: string | null }> {
	const { data: membership, error: membershipError } = await supabase
		.from("organization_memberships")
		.select("organization_id")
		.eq("user_id", userId)
		.limit(1)
		.maybeSingle();

	if (membershipError) {
		return { organizationId: "", error: membershipError.message };
	}
	if (membership?.organization_id) {
		return { organizationId: membership.organization_id, error: null };
	}

	const name = fallbackName.trim() || "Organization";
	const { data: org, error: orgError } = await supabase
		.from("organizations")
		.insert({ name, owner_user_id: userId })
		.select("id")
		.single();

	if (orgError || !org?.id) {
		return { organizationId: "", error: orgError?.message ?? "Could not create organization" };
	}

	const { error: linkError } = await supabase.from("organization_memberships").insert({
		organization_id: org.id,
		user_id: userId,
		role: "owner",
	});

	if (linkError) {
		return { organizationId: "", error: linkError.message };
	}

	return { organizationId: org.id, error: null };
}
