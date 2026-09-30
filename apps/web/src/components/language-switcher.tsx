"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

function btn(active: boolean, dark: boolean) {
	const base = "px-2.5 py-1 text-[11px] tracking-[0.08em]";
	if (dark) {
		return active ? `${base} text-white` : `${base} text-white/45 hover:text-white`;
	}
	return active ? `${base} bg-ink text-white` : `${base} text-ink/60 hover:text-ink`;
}

export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
	const locale = useLocale() as AppLocale;
	const router = useRouter();
	const pathname = usePathname();

	return (
		<div
			className={
				tone === "dark"
					? "flex items-center gap-1 border border-white/15 p-0.5"
					: "flex items-center gap-0.5 rounded-full border border-ink/10 bg-white/60 p-0.5 font-medium backdrop-blur-sm"
			}
		>
			<button type="button" className={btn(locale === "en", tone === "dark")} onClick={() => router.replace(pathname, { locale: "en" })}>
				EN
			</button>
			<button type="button" className={btn(locale === "bg", tone === "dark")} onClick={() => router.replace(pathname, { locale: "bg" })}>
				БГ
			</button>
			<button type="button" className={btn(locale === "ar", tone === "dark")} onClick={() => router.replace(pathname, { locale: "ar" })}>
				ع
			</button>
		</div>
	);
}
