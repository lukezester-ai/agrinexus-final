"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

function btn(active: boolean) {
	const base =
		"rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-out hover:scale-[1.04] active:scale-[0.97]";
	return active ? `${base} bg-ink text-white` : `${base} text-ink/60 hover:text-ink`;
}

export function LanguageSwitcher() {
	const locale = useLocale() as AppLocale;
	const router = useRouter();
	const pathname = usePathname();

	return (
		<div className="flex items-center gap-0.5 rounded-full border border-ink/10 bg-white/60 p-0.5 font-medium backdrop-blur-sm transition-shadow duration-300 ease-out hover:shadow-sm">
			<button
				type="button"
				className={btn(locale === "en")}
				onClick={() => router.replace(pathname, { locale: "en" })}
			>
				EN
			</button>
			<button
				type="button"
				className={btn(locale === "bg")}
				onClick={() => router.replace(pathname, { locale: "bg" })}
			>
				БГ
			</button>
		</div>
	);
}
