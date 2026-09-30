import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SocialLogin from "@/components/Auth/SocialLogin";
import { PublicShell } from "@/components/public/public-site";
import { cutoverCopy, productLocale } from "@/lib/product-ux-copy";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	const c = cutoverCopy[productLocale(locale)];
	return { title: c.loginTitle, description: c.loginBody };
}

export default async function LoginPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = cutoverCopy[productLocale(locale)];

	return (
		<PublicShell locale={locale}>
			<main className="mx-auto max-w-md px-6 py-16">
				<p className="text-[11px] tracking-[0.18em] text-[#8fbf9a]">{c.loginKicker}</p>
				<h1 className="mt-3 text-3xl font-light text-white">{c.loginTitle}</h1>
				<p className="mt-3 text-sm text-white/70">{c.loginBody}</p>
				<div className="mt-8" role="group" aria-label={c.loginTitle}>
					<SocialLogin />
				</div>
				<p className="mt-8 text-sm">
					<Link href="/" className="text-white/70 no-underline hover:text-white">
						{c.loginBack}
					</Link>
				</p>
			</main>
		</PublicShell>
	);
}
