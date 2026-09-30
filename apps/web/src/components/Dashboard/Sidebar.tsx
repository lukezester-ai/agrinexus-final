"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { productLocale, shellCopy } from "@/lib/product-ux-copy";

function SidebarGroup({ label, items }: { label: string; items: { icon: string; label: string; href: string; active?: boolean }[] }) {
	return (
		<div className="flex flex-col gap-1">
			<div className="px-2 pb-1.5 text-[11px] tracking-[0.18em] text-white/45">{label}</div>
			{items.map((item) => (
				<Link
					key={item.href}
					href={item.href}
					className={`px-2 py-2 text-[13px] no-underline ${item.active ? "text-white" : "text-white/55 hover:text-white"}`}
				>
					{item.label}
				</Link>
			))}
		</div>
	);
}

export default function Sidebar({
	locale,
	userName,
	userMeta,
	unreadNotifications,
}: {
	locale: string;
	initials?: string;
	userName: string;
	userMeta: string;
	unreadNotifications: number;
}) {
	const c = shellCopy[productLocale(locale)];
	const pathname = usePathname();

	const items = [
		{ icon: "◎", label: c.radar, href: "/dashboard", active: pathname === "/dashboard" },
		{ icon: "●", label: unreadNotifications ? `${c.notifications} (${unreadNotifications})` : c.notifications, href: "/dashboard/notifications", active: pathname.startsWith("/dashboard/notifications") },
		{ icon: "◎", label: c.intents, href: "/dashboard/intents", active: pathname.startsWith("/dashboard/intents") },
		{ icon: "◎", label: c.opportunities, href: "/dashboard/opportunities", active: pathname.startsWith("/dashboard/opportunities") },
		{ icon: "✓", label: c.verification, href: "/dashboard/verification", active: pathname.startsWith("/dashboard/verification") },
		{ icon: "◎", label: c.start, href: "/dashboard/onboarding", active: pathname.startsWith("/dashboard/onboarding") },
		{ icon: "⚙", label: c.settings, href: "/dashboard/settings", active: pathname === "/dashboard/settings" },
	];

	return (
		<aside className="sticky top-0 hidden h-screen w-[220px] flex-shrink-0 flex-col gap-8 border-e border-white/10 bg-[#141618] px-4 py-6 md:flex">
			<Link href="/" className="px-2 text-white no-underline">
				<div className="text-[11px] tracking-[0.22em] text-[#8fbf9a]">AGRI NEXUS</div>
				<div className="mt-1 text-sm text-white/90">Universal Business Core</div>
			</Link>
			<SidebarGroup label={c.daily} items={items} />
			<div className="mt-auto flex flex-col gap-4 px-2">
				<LanguageSwitcher tone="dark" />
				<div>
					<div className="text-xs text-white/85">{userName}</div>
					<div className="text-[11px] text-white/45">{userMeta}</div>
				</div>
			</div>
		</aside>
	);
}
