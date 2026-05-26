import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Privacy",
	description: "Privacy placeholder for AgriNexus Next app.",
};

export default function PrivacyPage() {
	return (
		<main className="mx-auto max-w-2xl px-8 py-16 text-ink">
			<h1 className="text-2xl font-semibold">Privacy</h1>
			<p className="mt-4 text-sm text-ink/70">
				This is a short placeholder page so footer links work. Replace with your real privacy policy.
			</p>
			<p className="mt-8">
				<Link href="/" className="text-forest-700 underline underline-offset-4">
					← Home
				</Link>
			</p>
		</main>
	);
}
