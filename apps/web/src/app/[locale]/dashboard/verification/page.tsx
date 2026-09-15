import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { VerificationRequestForm } from "./VerificationRequestForm";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

const copy = {
	en: {
		title: "Organization verification",
		lead: "Submit factual organization evidence for controlled review. Verification never reveals confidential matching data.",
		organization: "Organization",
		status: "Verification status",
		states: { none: "Not requested", pending: "Pending review", approved: "Approved", rejected: "Rejected", suspended: "Suspended", revoked: "Revoked" },
		pending: "Your request is awaiting a privileged review. No further action is required.",
		approved: "This organization has an approved verification record.",
		restricted: "This verification state is managed by the review process. Contact support if you need clarification.",
		rejected: "The previous request was rejected. You may submit corrected evidence.",
	},
	bg: {
		title: "Проверка на организация",
		lead: "Изпратете фактически данни за организацията за контролиран преглед. Проверката не разкрива поверителни matching данни.",
		organization: "Организация",
		status: "Статус на проверката",
		states: { none: "Няма заявка", pending: "Чака преглед", approved: "Одобрена", rejected: "Отхвърлена", suspended: "Спряна", revoked: "Отнета" },
		pending: "Заявката чака привилегирован преглед. Не е нужно друго действие.",
		approved: "Организацията има одобрен verification запис.",
		restricted: "Този статус се управлява от процеса за преглед. Свържете се с поддръжката при въпроси.",
		rejected: "Предишната заявка е отхвърлена. Можете да изпратите коригирани данни.",
	},
	ar: {
		title: "التحقق من المنظمة",
		lead: "أرسل أدلة واقعية عن المنظمة لمراجعة مضبوطة. لا يكشف التحقق بيانات المطابقة السرية.",
		organization: "المنظمة",
		status: "حالة التحقق",
		states: { none: "لم يُطلب", pending: "بانتظار المراجعة", approved: "مقبول", rejected: "مرفوض", suspended: "معلّق", revoked: "ملغى" },
		pending: "الطلب بانتظار مراجعة مخوّلة. لا يلزم إجراء آخر.",
		approved: "لدى هذه المنظمة سجل تحقق مقبول.",
		restricted: "تُدار هذه الحالة من خلال عملية المراجعة. تواصل مع الدعم للاستفسار.",
		rejected: "رُفض الطلب السابق. يمكنك إرسال أدلة مصححة.",
	},
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = locale === "bg" ? copy.bg : locale === "ar" ? copy.ar : copy.en;
	return { title: t.title };
}

export default async function VerificationPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = locale === "bg" ? copy.bg : locale === "ar" ? copy.ar : copy.en;
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect(`/${locale}/login`);

	const { data: membership } = await supabase
		.from("organization_memberships")
		.select("organization_id, role, organizations(name)")
		.eq("user_id", user.id)
		.limit(1)
		.maybeSingle();
	if (!membership?.organization_id) redirect(`/${locale}/dashboard/onboarding`);

	const { data: verification } = await supabase
		.from("organization_verifications")
		.select("id, status, created_at, reviewed_at")
		.eq("organization_id", membership.organization_id)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	const { data: isReviewer } = await supabase.rpc("is_verification_reviewer_v1");

	const status = (verification?.status ?? "none") as keyof typeof t.states;
	const organizationRelation = membership.organizations as unknown as { name?: string } | null;
	const canRequest = status === "none" || status === "rejected";
	const message = status === "pending" ? t.pending : status === "approved" ? t.approved : status === "rejected" ? t.rejected : status === "none" ? null : t.restricted;

	return (
		<div className="mx-auto max-w-3xl px-4 py-6 md:px-7 md:py-8">
			<header className="mb-6">
				<h1 className="font-serif text-3xl tracking-[-0.02em]">{t.title}</h1>
				<p className="mt-2 max-w-2xl text-sm text-ink/60">{t.lead}</p>
				{isReviewer === true ? <Link href="/dashboard/verification/review" className="mt-3 inline-flex text-sm font-medium text-forest-800 underline">Open review queue</Link> : null}
			</header>
			<section className="mb-5 rounded-2xl border border-ink/10 bg-white/65 p-5">
				<p className="text-xs uppercase tracking-[0.08em] text-ink/45">{t.organization}</p>
				<p className="mt-1 text-lg font-medium">{organizationRelation?.name ?? "—"}</p>
				<p className="mt-4 text-xs uppercase tracking-[0.08em] text-ink/45">{t.status}</p>
				<p className="mt-1 font-medium">{t.states[status]}</p>
				{message ? <p className="mt-3 text-sm text-ink/65">{message}</p> : null}
			</section>
			{canRequest ? (
				<section className="rounded-2xl border border-ink/10 bg-white/65 p-5">
					<VerificationRequestForm locale={locale} organizationId={membership.organization_id} />
				</section>
			) : null}
		</div>
	);
}
