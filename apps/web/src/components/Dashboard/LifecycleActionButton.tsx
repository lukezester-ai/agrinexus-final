"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";

export function LifecycleActionButton({
	fn,
	args,
	label,
	confirmMessage,
}: {
	fn: string;
	args: Record<string, unknown>;
	label: string;
	confirmMessage: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	return (
		<div className="mt-3">
			<button
				type="button"
				disabled={pending}
				onClick={() => {
					if (!window.confirm(confirmMessage)) return;
					startTransition(async () => {
						setError(null);
						const { error: rpcError } = await supabase.rpc(fn, args);
						if (rpcError) {
							setError(rpcError.message);
							return;
						}
						router.refresh();
					});
				}}
				className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
			>
				{pending ? "Working…" : label}
			</button>
			{error ? <p className="mt-2 text-xs text-red-700" role="alert">{error}</p> : null}
		</div>
	);
}
