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
				<Link href="/methodology" className="transition-colors hover:text-ink">
					{t("methodology")}
				</Link>{" "}
				·{" "}
				<Link href="/privacy" className="transition-colors hover:text-ink">
					{t("privacy")}
				</Link>
			</p>
			<p className="mt-2 text-ink/50">
				{t("earlyAdopter")}{" "}
				<Link href="/login" className="text-ink/65 underline underline-offset-2 transition-colors hover:text-ink">
					{t("earlyAdopterCta")}
				</Link>
			</p>
			<p className="mx-auto mt-4 max-w-2xl text-left text-[10px] leading-relaxed text-ink/40 sm:text-center">
				{t("legalDisclaimer")}
			</p>
			<p className="mt-4 text-ink/45">
				{t("ownership")}{" "}
				{t("contactIntro")}{" "}
				<a
					href="mailto:info@agrinexus.eu"
					className="text-ink/55 underline underline-offset-2 transition-colors hover:text-ink"
				>
					info@agrinexus.eu
				</a>
			</p>
		</footer>
	);
}
