import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { CommunityHub } from "@/components/community/CommunityHub";
import { parseCommunityPost } from "@/lib/community";
import { buildAiCommunityDigest } from "@/lib/ai-community-insight";
import { isMistralConfigured } from "@/lib/mistral";
import type { AppLocale } from "@/i18n/routing";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "AI Community",
				description: "Масата на фермерите и AI мрежата — въпроси, пазар и инсайти.",
			}
		: {
				title: "AI Community",
				description: "Farmer's Table and the AI mesh — questions, market talk, and agent insights.",
			};
}

export const revalidate = 120;

export default async function CommunityPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const loc = locale as AppLocale;

	const supabase = createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	const { data: rows } = await supabase
		.from("community_posts")
		.select("*")
		.order("created_at", { ascending: false })
		.limit(80);

	const farmerPosts = (rows ?? [])
		.map((row) => parseCommunityPost(row as Record<string, unknown>))
		.filter((p): p is NonNullable<typeof p> => p != null);

	const { posts: aiDigest, poweredByMistral } = await buildAiCommunityDigest(loc);

	return (
		<main className="mx-auto min-w-0 max-w-5xl px-6 py-12 sm:py-14">
			<CommunityHub
				locale={locale}
				initialPosts={farmerPosts}
				aiDigest={aiDigest}
				isLoggedIn={Boolean(session)}
				mistralEnabled={poweredByMistral || isMistralConfigured()}
			/>
		</main>
	);
}
