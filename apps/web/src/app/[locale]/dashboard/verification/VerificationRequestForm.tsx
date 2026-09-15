"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";

const copy = {
	en: {
		registrationCountry: "Registration country",
		registrationNumber: "Company registration number",
		website: "Company website (optional)",
		note: "Review note (optional)",
		submit: "Submit verification request",
		submitting: "Submitting…",
		required: "Registration country and company registration number are required.",
		success: "Verification request submitted for review.",
	},
	bg: {
		registrationCountry: "Държава на регистрация",
		registrationNumber: "Регистрационен номер на компанията",
		website: "Уебсайт на компанията (незадължително)",
		note: "Бележка за проверката (незадължително)",
		submit: "Изпрати заявка за проверка",
		submitting: "Изпращане…",
		required: "Държавата и регистрационният номер са задължителни.",
		success: "Заявката за проверка е изпратена.",
	},
	ar: {
		registrationCountry: "بلد التسجيل",
		registrationNumber: "رقم تسجيل الشركة",
		website: "موقع الشركة (اختياري)",
		note: "ملاحظة للمراجعة (اختياري)",
		submit: "إرسال طلب التحقق",
		submitting: "جارٍ الإرسال…",
		required: "بلد التسجيل ورقم تسجيل الشركة مطلوبان.",
		success: "تم إرسال طلب التحقق للمراجعة.",
	},
} as const;

export function VerificationRequestForm({ locale, organizationId }: { locale: string; organizationId: string }) {
	const router = useRouter();
	const t = locale === "bg" ? copy.bg : locale === "ar" ? copy.ar : copy.en;
	const [registrationCountry, setRegistrationCountry] = useState("");
	const [registrationNumber, setRegistrationNumber] = useState("");
	const [website, setWebsite] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!registrationCountry.trim() || !registrationNumber.trim()) {
			setError(t.required);
			return;
		}

		setSubmitting(true);
		setError(null);
		setSuccess(false);
		const evidence = {
			registration_country: registrationCountry.trim().toUpperCase(),
			registration_number: registrationNumber.trim(),
			...(website.trim() ? { website: website.trim() } : {}),
			...(note.trim() ? { note: note.trim() } : {}),
		};
		const { error: commandError } = await supabase.rpc("request_organization_verification_v1", {
			p_organization_id: organizationId,
			p_evidence: evidence,
		});
		setSubmitting(false);
		if (commandError) {
			setError(commandError.message);
			return;
		}

		setSuccess(true);
		router.refresh();
	}

	const field = "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-forest-500";
	return (
		<form className="flex max-w-xl flex-col gap-4" onSubmit={submit}>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.registrationCountry}
				<input className={field} value={registrationCountry} onChange={(event) => setRegistrationCountry(event.target.value)} placeholder="BG" maxLength={8} required />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.registrationNumber}
				<input className={field} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} maxLength={80} required />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.website}
				<input className={field} type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" maxLength={240} />
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-ink/70">
				{t.note}
				<textarea className={field} rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
			</label>
			{error ? <p className="text-sm text-red-800">{error}</p> : null}
			{success ? <p className="text-sm text-semantic-success">{t.success}</p> : null}
			<button type="submit" disabled={submitting} className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50">
				{submitting ? t.submitting : t.submit}
			</button>
		</form>
	);
}
