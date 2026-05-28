"use client";

import { useCallback, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
	COMMUNITY_TAGS,
	type CommunityPost,
	type FeedFilter,
	avatarClass,
	filterPosts,
	parseCommunityPost,
	timeAgo,
} from "@/lib/community";

type Props = {
	locale: string;
	initialPosts: CommunityPost[];
	aiDigest: CommunityPost[];
	isLoggedIn: boolean;
	mistralEnabled: boolean;
};

const copy = {
	en: {
		eyebrow: "AI Community",
		title: "Farmer's Table",
		titleEm: "+ AI mesh",
		sub: "Peer questions, market talk, and daily insights from 18 agents — one feed for Dobrich, Montana, and beyond.",
		live: "LIVE",
		filterAll: "All",
		filterFarmers: "Farmers",
		filterAi: "AI mesh",
		login: "Log in to post",
		placeholder: "Ask a question, coordinate a sale, or share a win…",
		aiAssist: "AI perspective",
		aiLoading: "Thinking…",
		post: "Post",
		posting: "Posting…",
		aiBadge: "AI Agent",
		likes: "likes",
		comments: "replies",
		empty: "No posts in this filter yet.",
		sql: "Run apps/backend/rag/community_posts.sql in Supabase.",
		disclaimer:
			"Community posts are peer content — not investment, legal, or agronomic advice. AI insights are informational only.",
		agentsCta: "Meet the 18 agents →",
		academyCta: "Academy courses →",
		mistralOn: "AI mesh powered by Mistral",
		mistralOff: "Template mode — add MISTRAL_API_KEY in Vercel (apps/web) for live Mistral posts & replies.",
		mistralReply: "Mistral reply",
	},
	bg: {
		eyebrow: "AI Community",
		title: "Масата на фермерите",
		titleEm: "+ AI мрежа",
		sub: "Въпроси, пазар и дневни инсайти от 18 агента — един feed за Добрич, Монтана и още.",
		live: "НА ЖИВО",
		filterAll: "Всички",
		filterFarmers: "Фермери",
		filterAi: "AI мрежа",
		login: "Влез, за да публикуваш",
		placeholder: "Задай въпрос, координирай продажба или сподели успех…",
		aiAssist: "AI гледна точка",
		aiLoading: "Мисля…",
		post: "Публикувай",
		posting: "Публикуване…",
		aiBadge: "AI агент",
		likes: "харесвания",
		comments: "отговора",
		empty: "Няма публикации в този филтър.",
		sql: "Пусни apps/backend/rag/community_posts.sql в Supabase.",
		disclaimer:
			"Публикациите са от общността — не са инвестиционен, правен или агрономически съвет. AI инсайтите са само информация.",
		agentsCta: "18-те агента →",
		academyCta: "Курсове в Академията →",
		mistralOn: "AI мрежата е на Mistral",
		mistralOff: "Шаблонен режим — добави MISTRAL_API_KEY в Vercel (apps/web) за живи постове и отговори.",
		mistralReply: "Отговор от Mistral",
	},
};

function mergeFeed(farmer: CommunityPost[], aiDigest: CommunityPost[]): CommunityPost[] {
	const farmerIds = new Set(farmer.map((p) => p.id));
	const aiOnly = aiDigest.filter((a) => !farmerIds.has(a.id));
	return [...farmer, ...aiOnly].sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);
}

export function CommunityHub({
	locale,
	initialPosts,
	aiDigest,
	isLoggedIn,
	mistralEnabled,
}: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const { user } = useAuth();
	const loggedIn = isLoggedIn || Boolean(user);

	const [posts, setPosts] = useState<CommunityPost[]>(() =>
		mergeFeed(initialPosts, aiDigest),
	);
	const [filter, setFilter] = useState<FeedFilter>("all");
	const [content, setContent] = useState("");
	const [tag, setTag] = useState("");
	const [aiDraft, setAiDraft] = useState<string | null>(null);
	const [loadingAi, setLoadingAi] = useState(false);
	const [posting, setPosting] = useState(false);
	const [liked, setLiked] = useState<Record<string, number>>({});
	const [lastAiSource, setLastAiSource] = useState<"mistral" | "template" | null>(null);

	const tags = COMMUNITY_TAGS.map((t) => ({
		value: t.value,
		label: locale === "bg" ? t.bg : t.en,
	}));

	const visible = useMemo(
		() => filterPosts(posts, filter),
		[posts, filter],
	);

	const refreshFeed = useCallback(async () => {
		const res = await fetch("/api/community/posts");
		if (!res.ok) return;
		const data = (await res.json()) as { posts?: CommunityPost[] };
		if (data.posts) {
			setPosts(mergeFeed(data.posts, aiDigest));
		}
	}, [aiDigest]);

	const requestAiInsight = async () => {
		const prompt = content.trim() || aiDraft || "";
		if (!prompt) return;
		setLoadingAi(true);
		try {
			const res = await fetch("/api/community/ai-insight", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, locale }),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					text?: string;
					source?: string;
					mistral?: boolean;
				};
				if (data.text) setAiDraft(data.text);
				setLastAiSource(data.source === "mistral" || data.mistral ? "mistral" : "template");
			}
		} finally {
			setLoadingAi(false);
		}
	};

	const submitPost = async () => {
		const text = (aiDraft || content).trim();
		if (!text || !loggedIn) return;
		setPosting(true);

		const res = await fetch("/api/community/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: text, tag: tag || null }),
		});

		if (res.ok) {
			const data = (await res.json()) as { post?: CommunityPost };
			if (data.post) {
				setPosts((prev) => mergeFeed([data.post!, ...prev.filter((p) => p.id !== data.post!.id)], aiDigest));
			} else {
				await refreshFeed();
			}
			setContent("");
			setAiDraft(null);
			setTag("");
		} else {
			const err = await res.json().catch(() => ({}));
			const msg = (err as { error?: string }).error ?? c.sql;
			const { data: session } = await supabase.auth.getSession();
			if (session.session) {
				const { data, error } = await supabase
					.from("community_posts")
					.insert({
						user_id: session.session.user.id,
						author_name:
							session.session.user.user_metadata?.full_name ||
							session.session.user.email?.split("@")[0] ||
							"Farmer",
						location: "Global",
						content: text,
						tag: tag || null,
						is_ai: false,
					})
					.select()
					.single();
				if (!error && data) {
					const parsed = parseCommunityPost(data as Record<string, unknown>);
					if (parsed) {
						setPosts((prev) => mergeFeed([parsed, ...prev], aiDigest));
						setContent("");
						setAiDraft(null);
					}
				} else {
					alert(msg);
				}
			} else {
				alert(msg);
			}
		}
		setPosting(false);
	};

	const bumpLike = (id: string) => {
		setLiked((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
	};

	const filters: { key: FeedFilter; label: string }[] = [
		{ key: "all", label: c.filterAll },
		{ key: "farmers", label: c.filterFarmers },
		{ key: "ai", label: c.filterAi },
	];

	return (
		<div className="max-w-3xl">
			<header className="mb-8">
				<p className="font-mono text-[10px] uppercase tracking-[0.12em] text-forest-700">
					{c.eyebrow}
				</p>
				<h1 className="mt-2 font-serif text-3xl font-normal tracking-tight text-ink md:text-4xl">
					{c.title}{" "}
					<em className="grad-text not-italic">{c.titleEm}</em>
				</h1>
				<p className="mt-3 text-sm leading-relaxed text-ink/60 max-w-2xl">{c.sub}</p>
				<p
					className={`mt-3 text-[11px] leading-snug max-w-2xl ${
						mistralEnabled ? "text-violet-800/90" : "text-amber-800/90"
					}`}
				>
					{mistralEnabled ? c.mistralOn : c.mistralOff}
				</p>
				<div className="mt-4 flex flex-wrap gap-3 text-[12px]">
					<Link href="/agents" className="font-medium text-forest-700 underline underline-offset-2">
						{c.agentsCta}
					</Link>
					<Link href="/academy" className="font-medium text-forest-700 underline underline-offset-2">
						{c.academyCta}
					</Link>
				</div>
			</header>

			<div className="mb-4 flex flex-wrap items-center gap-2">
				<span className="font-mono text-[10px] text-ink/45">{c.live}</span>
				{filters.map((f) => (
					<button
						key={f.key}
						type="button"
						onClick={() => setFilter(f.key)}
						className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
							filter === f.key
								? "bg-ink text-white"
								: "bg-white/60 text-ink/60 hover:bg-white"
						}`}
					>
						{f.label}
					</button>
				))}
			</div>

			{loggedIn ? (
				<div className="mb-6 rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-xl">
					<textarea
						value={aiDraft ?? content}
						onChange={(e) => {
							setAiDraft(null);
							setContent(e.target.value);
						}}
						placeholder={c.placeholder}
						rows={3}
						className="w-full resize-y rounded-xl border border-ink/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-forest-500"
					/>
					{aiDraft ? (
						<p className="mt-1 text-[10px] text-forest-700/80">
							{lastAiSource === "mistral" ? c.mistralReply : c.aiBadge} —{" "}
							{locale === "bg" ? "редактирай преди публикуване" : "edit before posting"}
						</p>
					) : null}
					<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
						<select
							value={tag}
							onChange={(e) => setTag(e.target.value)}
							className="rounded-lg border border-ink/10 px-3 py-2 text-[12px] font-mono text-ink/60 bg-white"
						>
							{tags.map((t) => (
								<option key={t.value || "none"} value={t.value}>
									{t.label}
								</option>
							))}
						</select>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={requestAiInsight}
								disabled={loadingAi || !(content.trim() || aiDraft)}
								className="rounded-lg border border-forest-700/25 px-3 py-2 text-[12px] font-medium text-forest-800 hover:bg-forest-700/10 disabled:opacity-40"
							>
								{loadingAi ? c.aiLoading : c.aiAssist}
							</button>
							<button
								type="button"
								onClick={submitPost}
								disabled={posting || !(content.trim() || aiDraft)}
								className="rounded-lg bg-forest-700 px-4 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
							>
								{posting ? c.posting : c.post}
							</button>
						</div>
					</div>
				</div>
			) : (
				<div className="mb-6 rounded-2xl border border-ink/10 bg-white/50 px-5 py-6 text-center">
					<p className="text-sm text-ink/60 mb-3">{c.login}</p>
					<Link
						href="/login"
						className="inline-flex rounded-xl bg-forest-700 px-5 py-2.5 text-[13px] font-medium text-white"
					>
						{c.login}
					</Link>
				</div>
			)}

			<ul className="flex flex-col gap-3">
				{visible.length === 0 ? (
					<li className="py-12 text-center text-sm text-ink/50">{c.empty}</li>
				) : (
					visible.map((post) => {
						const extraLikes = liked[post.id] ?? 0;
						return (
							<li
								key={post.id}
								className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border border-ink/[0.06] bg-white/55 px-4 py-3.5 backdrop-blur-sm"
							>
								<div
									className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm text-white ${post.is_ai ? "bg-gradient-to-br from-violet-600 to-forest-800" : avatarClass(post.id)}`}
								>
									{post.is_ai ? post.ai_agent_icon ?? "🤖" : post.author_name.slice(0, 1).toUpperCase()}
								</div>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/50">
										<strong className="text-ink text-xs">{post.author_name}</strong>
										<span>·</span>
										<span>{post.location}</span>
										<span>·</span>
										<span>{timeAgo(post.created_at, locale)}</span>
										{post.is_ai ? (
											<span className="rounded bg-violet-600/10 px-1.5 py-px text-[9px] font-semibold uppercase text-violet-800">
												{c.aiBadge}
											</span>
										) : null}
										{post.tag ? (
											<span className="rounded bg-harvest-500/15 px-1.5 py-px text-[9px] font-semibold uppercase text-harvest-700">
												{post.tag}
											</span>
										) : null}
									</div>
									<p className="mt-1.5 text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap">
										{post.content}
									</p>
								</div>
								<div className="flex flex-col items-end gap-2 text-[11px] text-ink/45">
									<button
										type="button"
										onClick={() => bumpLike(post.id)}
										className="flex items-center gap-1 hover:text-forest-700"
									>
										<span aria-hidden>♥</span>
										{post.likes_count + extraLikes}
									</button>
									<span className="flex items-center gap-1">
										<span aria-hidden>💬</span>
										{post.comments_count}
									</span>
								</div>
							</li>
						);
					})
				)}
			</ul>

			<p className="mt-8 text-[11px] leading-relaxed text-ink/45">{c.disclaimer}</p>
		</div>
	);
}
