import Link from "next/link";

type NavProps = {
	active?: "platform" | "market" | "agents" | "academy" | "sponsors";
};

const links: { href: string; label: string; key: NonNullable<NavProps["active"]> }[] = [
	{ href: "/platform", label: "Platform", key: "platform" },
	{ href: "/market", label: "Market intelligence", key: "market" },
	{ href: "/agents", label: "Agents", key: "agents" },
	{ href: "/academy", label: "Academy", key: "academy" },
	{ href: "/sponsors", label: "Sponsors", key: "sponsors" },
];

export function Nav({ active }: NavProps) {
	return (
		<nav className="sticky top-0 z-50 flex items-center justify-between border-b border-ink/[0.05] bg-paper/65 px-8 py-4 backdrop-blur-xl">
			<Link href="/" className="flex items-center gap-2.5 text-sm font-medium text-ink no-underline">
				<span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-[13px] text-white shadow-[0_2px_10px_rgba(31,77,44,0.25)]">
					✦
				</span>
				<span>AgriNexus</span>
			</Link>

			<div className="hidden gap-6 text-[13px] md:flex">
				{links.map((l) => (
					<Link
						key={l.key}
						href={l.href}
						className={
							active === l.key ? "font-medium text-ink" : "text-ink/60 transition-colors hover:text-ink"
						}
					>
						{l.label}
					</Link>
				))}
			</div>

			<Link
				href="/dashboard"
				className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-ink/90"
			>
				Join free →
			</Link>
		</nav>
	);
}
