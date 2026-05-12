/**
 * Стартира dev API (`server/dev-server.ts`) на свободен порт и проверява
 * GET /, GET /api и POST /api/contact (honeypot + formOpenedAt като в продукция).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = join(root, "node_modules", "tsx", "dist", "cli.mjs");

async function getFreePort() {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.unref();
		s.on("error", reject);
		s.listen(0, "127.0.0.1", () => {
			const addr = s.address();
			const port = typeof addr === "object" && addr ? addr.port : null;
			s.close(() => (port ? resolve(port) : reject(new Error("no port"))));
		});
	});
}

/** @param {number} port */
function httpJson(port, path, { method = "GET", headers = {}, body } = {}) {
	return new Promise((resolve, reject) => {
		const payload = body != null ? Buffer.from(body, "utf-8") : null;
		const req = http.request(
			{
				hostname: "127.0.0.1",
				port,
				path,
				method,
				headers: {
					...headers,
					...(payload ? { "Content-Length": String(payload.length) } : {}),
				},
			},
			(res) => {
				const chunks = [];
				res.on("data", (c) => chunks.push(c));
				res.on("end", () => {
					const text = Buffer.concat(chunks).toString("utf-8");
					let json = null;
					try {
						json = text ? JSON.parse(text) : {};
					} catch {
						/* leave json null */
					}
					resolve({
						ok: res.statusCode >= 200 && res.statusCode < 300,
						status: res.statusCode,
						text,
						json,
					});
				});
			},
		);
		req.on("error", reject);
		if (payload) req.write(payload);
		req.end();
	});
}

async function waitForRoot(port, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	let lastErr = "";
	while (Date.now() < deadline) {
		try {
			const r = await httpJson(port, "/");
			if (r.ok && r.json?.ok && r.json?.service === "sima-dev-api") return;
			lastErr = `${r.status} ${r.text?.slice(0, 120) || ""}`;
		} catch (e) {
			lastErr = e.message || String(e);
		}
		await new Promise((r) => setTimeout(r, 150));
	}
	throw new Error(`dev API не отговори навреме: ${lastErr}`);
}

async function main() {
	const port = await getFreePort();

	const child = spawn(process.execPath, [tsxCli, "server/dev-server.ts"], {
		cwd: root,
		env: {
			...process.env,
			DEV_API_PORT: String(port),
			PORT: String(port),
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	const kill = () => {
		try {
			child.kill("SIGTERM");
		} catch {
			/* ignore */
		}
	};

	try {
		await waitForRoot(port, 45_000);

		const apiList = await httpJson(port, "/api");
		if (!apiList.ok || !apiList.json?.routes) {
			throw new Error(`неочакван GET /api: ${apiList.text?.slice(0, 200)}`);
		}

		const opened = Date.now() - 5000;
		const contactBody = JSON.stringify({
			hpCompanyWebsite: "",
			formOpenedAt: opened,
			name: "smoke",
			email: "smoke-ci@example.com",
			message: "CI smoke: контактно съобщение (мин. 8 знака).",
		});
		const contact = await httpJson(port, "/api/contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: contactBody,
		});
		if (!contact.ok) {
			throw new Error(`POST /api/contact ${contact.status}: ${contact.text}`);
		}
		if (!contact.json?.ok) {
			throw new Error(`POST /api/contact отговор: ${contact.text}`);
		}

		console.log("smoke-dev-api: OK (/, /api, POST /api/contact).");
	} finally {
		kill();
		await new Promise((r) => setTimeout(r, 500));
		if (child.exitCode === null && !child.killed) {
			try {
				child.kill("SIGKILL");
			} catch {
				/* ignore */
			}
		}
	}
}

await main().catch((err) => {
	console.error("smoke-dev-api:", err.message || err);
	process.exit(1);
});
