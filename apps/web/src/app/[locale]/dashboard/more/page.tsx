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
		<div className="mx-auto w-full max-w-[720px] px-6 py-16">
			<h1 className="mb-8 text-4xl font-light text-white">{c.moreTitle}</h1>
			<ul className="flex flex-col gap-3">
				{c.moreItems.map((item) => (
					<li key={item.href}>
						<Link href={item.href} className="block border border-white/15 px-4 py-4 no-underline hover:border-white/40">
							<span className="block text-sm text-white">{item.label}</span>
							<span className="block text-xs text-white/55">{item.sub}</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
