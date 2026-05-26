"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
	const t = useTranslations("Footer");

	return (
		<footer className="mt-10 border-t border-ink/[0.06] px-8 py-8 text-center text-[11px] text-ink/40">
			<p>
				{t("line1")}{" "}
				<Link href="/sponsors" className="transition-colors hover:text-ink">
					{t("sponsors")}
				</Link>{" "}
				·{" "}
				<Link href="/sponsors#advertise" className="transition-colors hover:text-ink">
					{t("advertise")}
				</Link>{" "}
				·{" "}
				<Link href="/privacy" className="transition-colors hover:text-ink">
					{t("privacy")}
				</Link>
			</p>
			<p className="mt-2">{t("stats")}</p>
		</footer>
	);
}
