const copy = {
	en: { title: "Trust policy passed", body: "Both organizations are eligible for matching. This does not reveal identity or claim verified status." },
	bg: { title: "Премината trust политика", body: "И двете организации са допустими за matching. Това не разкрива самоличност и не означава потвърден verification статус." },
	ar: { title: "تم اجتياز سياسة الثقة", body: "كلتا المؤسستين مؤهلتان للمطابقة. هذا لا يكشف الهوية ولا يعني أن حالة التحقق معتمدة." },
} as const;

export function TrustEligibilitySignal({ locale }: { locale: string }) {
	const t = locale === "bg" ? copy.bg : locale === "ar" ? copy.ar : copy.en;
	return <div className="mt-3 rounded-xl border border-forest-200 bg-forest-50/50 px-3.5 py-3" data-testid="trust-eligibility-signal"><p className="text-xs font-semibold text-forest-800">{t.title}</p><p className="mt-1 text-xs leading-relaxed text-ink/60">{t.body}</p></div>;
}
