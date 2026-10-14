"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import type { ReturnLoopItem } from "@/lib/return-loop";
import { alertError, primaryAction } from "@/components/Dashboard/journey-ui";

export function NotificationInbox({ items, locale }: { items: ReturnLoopItem[]; locale: string }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string | null>(null);
	const bg = locale === "bg";
	const ar = locale === "ar";
	const copy = ar
		? { empty: "لا توجد إجراءات تنتظر المراجعة.", fresh: "جديد", opening: "جارٍ الفتح…", review: "راجع في الرادار" }
		: bg
			? { empty: "Няма действия, които чакат преглед.", fresh: "Ново", opening: "Отваря се…", review: "Прегледай в Радара" }
			: { empty: "No actions are waiting for review.", fresh: "New", opening: "Opening…", review: "Review in Radar" };

	function review(item: ReturnLoopItem) {
		startTransition(async () => {
			setMessage(null);
			const { error } = await supabase.rpc("mark_business_notification_read", {
				p_item_kind: item.kind,
				p_item_id: item.id,
				p_item_updated_at: item.updatedAt,
			});
			if (error) {
				setMessage(error.message);
				return;
			}
			router.push("/dashboard");
		});
	}

	if (!items.length) return <p className="mt-4 text-sm text-ink/50">{copy.empty}</p>;
	return (
		<>
			{message ? <p className={alertError} role="alert">{message}</p> : null}
			<ul className="mt-5 flex flex-col gap-3">
				{items.map((item) => (
					<li key={`${item.kind}:${item.id}:${item.updatedAt}`} className={`rounded-2xl border p-5 ${item.isUnread ? "border-harvest-200 bg-harvest-50/50" : "border-ink/[0.07] bg-white/60"}`}>
						<div className="flex items-center justify-between gap-3">
							<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{item.kind.replaceAll("_", " ")}</p>
							{item.isUnread ? <span className="rounded-full bg-harvest-100 px-2 py-1 text-[10px] font-medium text-harvest-700">{copy.fresh}</span> : null}
						</div>
						<h2 className="mt-2 font-serif text-xl text-ink">{item.title}</h2>
						{item.summary ? <p className="mt-2 text-sm leading-relaxed text-ink/60">{item.summary}</p> : null}
						<button type="button" disabled={pending} onClick={() => review(item)} className={`${primaryAction} mt-4`}>
							{pending ? copy.opening : copy.review}
						</button>
					</li>
				))}
			</ul>
		</>
	);
}
