import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { productLocale, shellCopy } from "@/lib/product-ux-copy";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return { title: shellCopy[productLocale(locale)].moreTitle };
}

export default async function DashboardMorePage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = shellCopy[productLocale(locale)];

	return (
		<div className="px-4 py-4 pb-6">
			<h1 className="mb-4 font-serif text-2xl text-ink">{c.moreTitle}</h1>
			<ul className="flex flex-col gap-2">
				{c.moreItems.map((item) => (
					<li key={item.href}>
						<Link
							href={item.href}
							className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/55 px-4 py-3.5 no-underline backdrop-blur-sm active:bg-white/80"
						>
							<span className="text-xl" aria-hidden>
								{item.icon}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-medium text-ink">{item.label}</span>
								<span className="block text-xs text-ink/50">{item.sub}</span>
							</span>
							<span className="text-ink/30 rtl:-scale-x-100">›</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
