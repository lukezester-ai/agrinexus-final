"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";

export function VerificationReviewActions({ verificationId }: { verificationId: string }) {
	const router = useRouter();
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function review(target: "approved" | "rejected") {
		if (!reason.trim()) {
			setError("A review reason is required.");
			return;
		}
		setPending(true);
		setError(null);
		const { error: commandError } = await supabase.rpc("review_organization_verification_authenticated_v1", {
			p_verification_id: verificationId,
			p_target_status: target,
			p_reason: reason.trim(),
		});
		setPending(false);
		if (commandError) {
			setError(commandError.message);
			return;
		}
		router.refresh();
	}

	return (
		<div className="mt-4 flex flex-col gap-3">
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				Review reason
				<textarea className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
			</label>
			{error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
			<div className="flex gap-2">
				<button type="button" disabled={pending} onClick={() => void review("approved")} className="rounded-xl bg-forest-700 px-4 py-2 text-sm text-white disabled:opacity-50">Approve</button>
				<button type="button" disabled={pending} onClick={() => void review("rejected")} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50">Reject</button>
			</div>
		</div>
	);
}
