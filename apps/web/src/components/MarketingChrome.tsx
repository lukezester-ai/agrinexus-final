"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/Footer";

/** Marketing shell (nav + footer). Skipped on dashboard routes — they use mobile bottom nav. */
export function MarketingChrome({ children }: { children: ReactNode }) {
	const pathname = usePathname() ?? "";
	const isDashboard = pathname.includes("/dashboard");

	if (isDashboard) {
		return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
	}

	return (
		<div className="relative z-[2] flex min-h-screen flex-col">
			<SiteNav />
			<div className="h-[5.75rem] shrink-0 md:h-24" aria-hidden />
			<div className="flex-1">{children}</div>
			<Footer />
		</div>
	);
}
