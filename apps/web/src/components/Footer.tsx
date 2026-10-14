"use client";

import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cutoverCopy, productLocale } from "@/lib/product-ux-copy";
import { parseAppLocale } from "@/i18n/routing";

export function Footer() {
	const params = useParams();
	const c = cutoverCopy[productLocale(parseAppLocale(params?.locale))];

	return (
		<footer className="mt-10 border-t border-ink/[0.06] px-8 py-8 text-center text-[11px] text-ink/40">
			<p>{c.footerLine}</p>
			<p className="mt-2 text-ink/50">
				<Link href="/privacy" className="transition-colors hover:text-ink">
					{c.footerPrivacy}
				</Link>
				{" · "}
				<Link href="/login" className="text-ink/65 underline underline-offset-2 transition-colors hover:text-ink">
					{c.footerLogin}
				</Link>
			</p>
			<p className="mx-auto mt-4 max-w-2xl text-left text-[10px] leading-relaxed text-ink/40 sm:text-center">{c.footerLegal}</p>
		</footer>
	);
}
