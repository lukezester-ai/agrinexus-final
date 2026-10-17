import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { fileURLToPath } from "url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Monorepo root (repo contains root + `apps/web` lockfiles — avoids Next tracing warning). */
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
	reactStrictMode: true,
	outputFileTracingRoot: monorepoRoot,
	/** Само в development: същия origin като Next → FastAPI (удобно за бъдещи client fetch). */
	async redirects() {
		const locales = ["en", "bg", "ar"];
		const legacy = ["academy", "market", "agents", "platform", "sponsors", "methodology", "fields", "community", "ask"];
		const toHome = legacy.flatMap((slug) => [
			{ source: `/${slug}`, destination: "/", permanent: false },
			{ source: `/${slug}/:path*`, destination: "/", permanent: false },
			...locales.map((locale) => ({
				source: `/${locale}/${slug}`,
				destination: `/${locale}`,
				permanent: false,
			})),
			...locales.map((locale) => ({
				source: `/${locale}/${slug}/:path*`,
				destination: `/${locale}`,
				permanent: false,
			})),
		]);
		/** Skill Squad is a single-page site: the locale roots have no separate home. */
		const localeRoots = locales.map((locale) => ({
			source: `/${locale}`,
			destination: "/",
			permanent: false,
		}));
		return [
			...localeRoots,
			...toHome,
			{ source: "/onboarding", destination: "/dashboard/onboarding", permanent: false },
			...locales.map((locale) => ({
				source: `/${locale}/onboarding`,
				destination: `/${locale}/dashboard/onboarding`,
				permanent: false,
			})),
		];
	},
	async rewrites() {
		const radarSmoke = {
			source: "/dev/radar-smoke",
			destination: "/en/dev/radar-smoke",
		};
		/**
		 * `/` serves the static Skill Squad landing from `public/landing`.
		 * `beforeFiles` is required: `app/[locale]/page.tsx` would otherwise win.
		 */
		const beforeFiles = [{ source: "/", destination: "/landing/index.html" }];
		const afterFiles = [radarSmoke];
		if (process.env.NODE_ENV === "development") {
			const origin = (process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");
			afterFiles.push({ source: "/api/py/:path*", destination: `${origin}/:path*` });
		}
		return { beforeFiles, afterFiles, fallback: [] };
	},
};

export default withNextIntl(nextConfig);
