export type CommunityTag = "QUESTION" | "MARKET" | "SUCCESS" | "FIELD" | "";

export type CommunityPost = {
	id: string;
	user_id: string | null;
	author_name: string;
	location: string;
	content: string;
	tag: CommunityTag | string | null;
	is_ai: boolean;
	ai_agent_slug: string | null;
	ai_agent_icon: string | null;
	likes_count: number;
	comments_count: number;
	created_at: string;
};

export const COMMUNITY_TAGS: { value: CommunityTag; en: string; bg: string }[] = [
	{ value: "", en: "No tag", bg: "Без таг" },
	{ value: "QUESTION", en: "Question", bg: "Въпрос" },
	{ value: "MARKET", en: "Market", bg: "Пазар" },
	{ value: "FIELD", en: "Field", bg: "Поле" },
	{ value: "SUCCESS", en: "Success story", bg: "Успех" },
];

export function parseCommunityPost(raw: Record<string, unknown>): CommunityPost | null {
	const id = typeof raw.id === "string" ? raw.id : null;
	if (!id) return null;
	return {
		id,
		user_id: typeof raw.user_id === "string" ? raw.user_id : null,
		author_name: typeof raw.author_name === "string" ? raw.author_name : "Farmer",
		location: typeof raw.location === "string" ? raw.location : "Global",
		content: typeof raw.content === "string" ? raw.content : "",
		tag: typeof raw.tag === "string" ? raw.tag : null,
		is_ai: raw.is_ai === true,
		ai_agent_slug: typeof raw.ai_agent_slug === "string" ? raw.ai_agent_slug : null,
		ai_agent_icon: typeof raw.ai_agent_icon === "string" ? raw.ai_agent_icon : null,
		likes_count: typeof raw.likes_count === "number" ? raw.likes_count : 0,
		comments_count: typeof raw.comments_count === "number" ? raw.comments_count : 0,
		created_at:
			typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
	};
}

export function timeAgo(iso: string, locale: string): string {
	const date = new Date(iso);
	const now = Date.now();
	const seconds = Math.floor((now - date.getTime()) / 1000);
	if (seconds < 60) return locale === "bg" ? "току-що" : "just now";
	const mins = Math.floor(seconds / 60);
	if (mins < 60) return locale === "bg" ? `${mins} мин` : `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return locale === "bg" ? `${hours} ч` : `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return locale === "bg" ? `${days} д` : `${days}d ago`;
}

export function avatarClass(id: string): string {
	const hash = id.charCodeAt(0) || 0;
	return ["bg-forest-700", "bg-harvest-600", "bg-earth-600"][hash % 3];
}

export type FeedFilter = "all" | "farmers" | "ai";

export function filterPosts(posts: CommunityPost[], filter: FeedFilter): CommunityPost[] {
	if (filter === "farmers") return posts.filter((p) => !p.is_ai);
	if (filter === "ai") return posts.filter((p) => p.is_ai);
	return posts;
}
