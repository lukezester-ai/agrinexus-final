"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cutoverCopy, productLocale } from "@/lib/product-ux-copy";
import { WORKING_PRODUCT_MARK, WORKING_PRODUCT_NAME } from "@/lib/product-identity";

type NavProps = {
	locale: string;
};

export function Nav({ locale }: NavProps) {
	const c = cutoverCopy[productLocale(locale)];
	const [isOpen, setIsOpen] = useState(false);

	return (
		<header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-3 sm:px-4">
			<nav
				className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-2 rounded-2xl border border-ink/[0.08] bg-paper/70 px-3 py-2.5 shadow-[0_12px_48px_rgba(14,40,24,0.12)] ring-1 ring-white/60 backdrop-blur-2xl sm:gap-3 sm:px-5 sm:py-3"
				aria-label="Main"
			>
				<Link
					href="/"
					className="group flex min-w-0 shrink items-center gap-2 rounded-xl px-1 py-0.5 text-sm font-medium text-ink no-underline transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-white/50 active:scale-[0.99] md:shrink-0"
					onClick={() => setIsOpen(false)}
				>
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[12px] text-white shadow-[0_2px_10px_rgba(31,77,44,0.25)] sm:h-8 sm:w-8 sm:text-[13px]">
						{WORKING_PRODUCT_MARK}
					</span>
					<span className="truncate sm:max-w-none">{WORKING_PRODUCT_NAME}</span>
				</Link>

				<div className="hidden min-w-0 flex-1 items-center justify-center gap-4 text-[13px] lg:flex">
					<Link href="/" className="rounded-xl px-2 py-1.5 text-ink/65 no-underline transition-colors hover:text-ink">
						{c.navHow}
					</Link>
				</div>

				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<LanguageSwitcher />
					<Link
						href="/dashboard"
						className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white shadow-md transition-all duration-300 ease-out hover:scale-[1.03] hover:bg-ink/90 sm:px-4 sm:py-2 sm:text-xs"
					>
						{c.navRadar}
					</Link>
					<button
						type="button"
						className="flex items-center justify-center rounded-lg p-1.5 text-ink/70 hover:bg-white/50 hover:text-ink lg:hidden"
						onClick={() => setIsOpen(!isOpen)}
						aria-label="Toggle menu"
					>
						{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</nav>

			{isOpen && (
				<div className="pointer-events-auto absolute inset-x-3 top-[calc(100%+0.5rem)] mx-auto max-w-5xl rounded-2xl border border-ink/[0.08] bg-paper/95 p-3 shadow-xl backdrop-blur-3xl sm:inset-x-4 lg:hidden">
					<Link
						href="/"
						onClick={() => setIsOpen(false)}
						className="block rounded-xl px-3 py-2.5 text-ink/70 no-underline hover:bg-white/50 hover:text-ink"
					>
						{c.navHow}
					</Link>
					<Link
						href="/dashboard/onboarding"
						onClick={() => setIsOpen(false)}
						className="mt-1 block rounded-xl px-3 py-2.5 text-ink/70 no-underline hover:bg-white/50 hover:text-ink"
					>
						{c.ctaIntent}
					</Link>
				</div>
			)}
		</header>
	);
}
