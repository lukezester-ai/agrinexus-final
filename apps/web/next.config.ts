import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Monorepo root (repo contains root + `apps/web` lockfiles — avoids Next tracing warning). */
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
	reactStrictMode: true,
	outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;