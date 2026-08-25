import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SocialLogin from "@/components/Auth/SocialLogin";
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
		<main className="mx-auto max-w-md px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{c.loginKicker}</p>
			<h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{c.loginTitle}</h1>
			<p className="mt-2 text-sm text-slate-600">{c.loginBody}</p>
			<div className="mt-8 flex justify-center" role="group" aria-label={c.loginTitle}>
				<SocialLogin />
			</div>
			<p className="mt-8 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					{c.loginBack}
				</Link>
			</p>
		</main>
	);
}
