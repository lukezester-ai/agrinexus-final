import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { VerificationReviewActions } from "./VerificationReviewActions";

type PageProps = { params: Promise<{ locale: string }> };

type ReviewRow = {
	verification_id: string;
	organization_name: string;
	evidence: Record<string, unknown>;
	requested_at: string;
};

export default async function VerificationReviewPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect(`/${locale}/login`);

	const { data: isReviewer, error: reviewerError } = await supabase.rpc("is_verification_reviewer_v1");
	if (reviewerError || isReviewer !== true) notFound();
	const { data, error } = await supabase.rpc("verification_review_queue_v1");
	if (error) throw new Error("Could not load verification review queue");
	const rows = (data ?? []) as ReviewRow[];

	return (
		<div className="mx-auto max-w-4xl px-4 py-6 md:px-7 md:py-8">
			<header className="mb-6">
				<h1 className="font-serif text-3xl tracking-[-0.02em]">Verification review</h1>
				<p className="mt-2 text-sm text-ink/60">Privileged evidence review. Every decision requires a reason and creates an audit event.</p>
			</header>
			{rows.length === 0 ? <p className="rounded-2xl border border-ink/10 bg-white/65 p-5 text-sm text-ink/60">No pending verification requests.</p> : null}
			<div className="flex flex-col gap-4">
				{rows.map((row) => (
					<article key={row.verification_id} className="rounded-2xl border border-ink/10 bg-white/65 p-5">
						<h2 className="text-lg font-medium">{row.organization_name}</h2>
						<p className="mt-1 text-xs text-ink/45">Requested {new Date(row.requested_at).toLocaleString(locale)}</p>
						<dl className="mt-4 grid gap-2 text-sm">
							{Object.entries(row.evidence ?? {}).map(([key, value]) => (
								<div key={key} className="grid gap-1 md:grid-cols-[180px_1fr]"><dt className="font-medium text-ink/60">{key.replaceAll("_", " ")}</dt><dd className="break-words">{String(value)}</dd></div>
							))}
						</dl>
						<VerificationReviewActions verificationId={row.verification_id} />
					</article>
				))}
			</div>
		</div>
	);
}
