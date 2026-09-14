"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { alertError, primaryAction, quietAction, secondaryAction } from "@/components/Dashboard/journey-ui";

const copy = {
	en: {
		touch: "Record interaction",
		pause: "Pause relationship",
		resume: "Resume relationship",
		close: "Close relationship",
		working: "Working…",
	},
	bg: {
		touch: "Запиши взаимодействие",
		pause: "Постави връзката на пауза",
		resume: "Възобнови връзката",
		close: "Затвори връзката",
		working: "Обработва се…",
	},
} as const;

export function RelationshipActions({
	relationshipId,
	status,
	locale,
}: {
	relationshipId: string;
	status: string;
	locale: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string | null>(null);
	const t = locale === "bg" ? copy.bg : copy.en;

	function run(command: string, confirmText?: string) {
		if (confirmText && !window.confirm(confirmText)) return;
		startTransition(async () => {
			setMessage(null);
			const { error } = await supabase.rpc(command, { p_relationship_id: relationshipId });
			if (error) {
				setMessage(error.message);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className="mt-4" aria-busy={pending}>
			<div className="flex flex-wrap gap-2">
				{status !== "closed" ? (
					<button type="button" disabled={pending} onClick={() => run("touch_business_relationship")} className={primaryAction}>
						{pending ? t.working : t.touch}
					</button>
				) : null}
				{status === "active" ? (
					<button type="button" disabled={pending} onClick={() => run("pause_business_relationship")} className={secondaryAction}>
						{t.pause}
					</button>
				) : null}
				{status === "paused" ? (
					<button type="button" disabled={pending} onClick={() => run("resume_business_relationship")} className={secondaryAction}>
						{t.resume}
					</button>
				) : null}
				{status !== "closed" ? (
					<button
						type="button"
						disabled={pending}
						onClick={() => run("close_business_relationship", "Close this business relationship? This action is audited.")}
						className={quietAction}
					>
						{t.close}
					</button>
				) : null}
			</div>
			{message ? <p className={alertError} role="alert">{message}</p> : null}
		</div>
	);
}
