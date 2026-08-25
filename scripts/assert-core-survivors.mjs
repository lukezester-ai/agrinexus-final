import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
	path.join(ROOT, "apps/web/src"),
	path.join(ROOT, "apps/backend/app"),
];

const FORBIDDEN = [
	/@agriculture\//,
	/@agriculture\//,
	/verticals\/agriculture/,
	/runAgrinexusChat/,
	/runAgrinexusChat/,
	/academy-courses/,
	/academy-lab/,
	/farmContext/,
	/farmContext/,
	/wheat-ref/,
	/break-even/,
];

const SKIP_DIR = new Set(["node_modules", ".next", "__pycache__"]);

function walk(dir, acc = []) {
	if (!fs.existsSync(dir)) return acc;
	for (const name of fs.readdirSync(dir)) {
		if (SKIP_DIR.has(name)) continue;
		const full = path.join(dir, name);
		const stat = fs.statSync(full);
		if (stat.isDirectory()) walk(full, acc);
		else if (/\.(ts|tsx|js|py)$/.test(name)) acc.push(full);
	}
	return acc;
}

const hits = [];
for (const root of TARGETS) {
	for (const file of walk(root)) {
		const text = fs.readFileSync(file, "utf8");
		for (const re of FORBIDDEN) {
			if (re.test(text)) {
				hits.push(`${path.relative(ROOT, file)}  matches ${re}`);
			}
		}
	}
}

if (hits.length) {
	console.error("CORE SURVIVORS boundary failed:\n" + hits.join("\n"));
	process.exit(1);
}

console.log("CORE SURVIVORS boundary ok: no agriculture/academy/legacy imports in core graph.");
