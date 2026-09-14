import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { NotificationInbox } from "@/components/Dashboard/NotificationInbox";
import { loadReturnLoopItems } from "@/lib/return-loop";

type PageProps = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const { items, error } = await loadReturnLoopItems();
	const bg = locale === "bg";
	const ar = locale === "ar";
	const copy = ar
		? { eyebrow: "العودة إلى الإجراء", title: "الإشعارات", lead: "إجراءات أعمال محددة فقط — بلا موجز ولا ضوضاء.", unavailable: "الإشعارات غير متاحة بعد في قاعدة البيانات هذه." }
		: bg
			? { eyebrow: "Връщане към действие", title: "Известия", lead: "Само конкретни бизнес действия — без feed и шум.", unavailable: "Известията още не са налични в тази база." }
			: { eyebrow: "Return to action", title: "Notifications", lead: "Only concrete business actions — no feed and no noise.", unavailable: "Notifications are not available on this database yet." };
	return (
		<div className="mx-auto max-w-3xl px-4 py-5 pb-12 md:px-7">
			<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">{copy.eyebrow}</p>
			<h1 className="mt-2 font-serif text-3xl text-ink">{copy.title}</h1>
			<p className="mt-3 text-sm leading-relaxed text-ink/60">{copy.lead}</p>
			{error ? <p className="mt-4 rounded-xl border border-semantic-alert/25 bg-[#FBF4F4] px-3.5 py-3 text-sm text-semantic-alert">{copy.unavailable}</p> : <NotificationInbox items={items} locale={locale} />}
		</div>
	);
}
