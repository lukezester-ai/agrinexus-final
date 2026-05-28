import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseCommunityPost } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function GET() {
	const supabase = createClient();
	const { data, error } = await supabase
		.from("community_posts")
		.select("*")
		.order("created_at", { ascending: false })
		.limit(80);

	if (error) {
		return NextResponse.json({ posts: [], error: error.message });
	}

	const posts = (data ?? [])
		.map((row) => parseCommunityPost(row as Record<string, unknown>))
		.filter((p): p is NonNullable<typeof p> => p != null);

	return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: {
		content?: string;
		tag?: string;
		location?: string;
	};
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const content = typeof body.content === "string" ? body.content.trim() : "";
	if (!content || content.length > 4000) {
		return NextResponse.json({ error: "Content required (max 4000)" }, { status: 400 });
	}

	const { data: profile } = await supabase
		.from("farm_profiles")
		.select("full_name, region")
		.eq("user_id", session.user.id)
		.single();

	const authorName =
		profile?.full_name ||
		session.user.user_metadata?.full_name ||
		session.user.email?.split("@")[0] ||
		"Farmer";
	const location = profile?.region || body.location || "Global";

	const { data, error } = await supabase
		.from("community_posts")
		.insert({
			user_id: session.user.id,
			author_name: authorName,
			location,
			content,
			tag: body.tag || null,
			is_ai: false,
		})
		.select()
		.single();

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 });
	}

	const post = parseCommunityPost(data as Record<string, unknown>);
	return NextResponse.json({ post });
}
