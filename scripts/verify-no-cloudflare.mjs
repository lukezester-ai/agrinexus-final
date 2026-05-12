/**
 * Проверява, че в изходния код няма интеграция с Cloudflare Turnstile / challenge.
 * Не сканираме `.md` (чернови/TODO) и не пипаме `node_modules`.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const SKIP_DIR = new Set([
	"node_modules",
	".git",
	"dist",
	".vite",
	"coverage",
	"checkpoints",
	"bin",
	".local",
]);

const SCAN_EXT = new Set([
	".html",
	".js",
	".mjs",
	".cjs",
	".jsx",
	".ts",
	".tsx",
	".css",
	".json",
	".example",
]);

const FORBIDDEN = [
	{ re: /\bturnstile\b/i, label: "turnstile" },
	{ re: /challenges\.cloudflare\.com/i, label: "challenges.cloudflare.com" },
	{ re: /\bcf-turnstile\b/i, label: "cf-turnstile" },
	{ re: /\bTURNSTILE_[A-Z0-9_]+\b/, label: "TURNSTILE_* env" },
];

async function walk(dir, out) {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const ent of entries) {
		const p = join(dir, ent.name);
		const rel = relative(root, p).replace(/\\/g, "/");
		if (rel === "scripts/verify-no-cloudflare.mjs" || rel === "scripts/smoke-dev-api.mjs") continue;

		if (ent.isDirectory()) {
			if (SKIP_DIR.has(ent.name)) continue;
			await walk(p, out);
		} else if (ent.isFile()) {
			const ext = ent.name.includes(".") ? "." + ent.name.split(".").pop() : "";
			if (!SCAN_EXT.has(ext)) continue;
			if (ent.name === "package-lock.json") continue;
			out.push(p);
		}
	}
}

async function main() {
	const files = [];
	await walk(root, files);

	const hits = [];
	for (const file of files) {
		let text;
		try {
			text = await readFile(file, "utf-8");
		} catch {
			continue;
		}
		for (const { re, label } of FORBIDDEN) {
			if (re.test(text)) {
				hits.push({ file: relative(root, file), label });
			}
		}
	}

	if (hits.length) {
		console.error("verify-no-cloudflare: намерени забранени шаблони:\n");
		for (const h of hits) {
			console.error(`  ${h.label} → ${h.file}`);
		}
		process.exit(1);
	}

	console.log("verify-no-cloudflare: OK (няма Turnstile / Cloudflare challenge в кода).");
}

await main();
