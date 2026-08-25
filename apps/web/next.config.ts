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
	async rewrites() {
		const radarSmoke = {
			source: "/dev/radar-smoke",
			destination: "/en/dev/radar-smoke",
		};
		if (process.env.NODE_ENV !== "development") return [radarSmoke];
		const origin = (process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");
		return [radarSmoke, { source: "/api/py/:path*", destination: `${origin}/:path*` }];
	},
};

export default withNextIntl(nextConfig);
