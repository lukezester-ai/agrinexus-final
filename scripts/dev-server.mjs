/**
 * Static site + APIs for local dev.
 * Usage: npm run dev  (from repo root — same folder as package.json)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const rootResolved = resolve(root);
const port = Number(process.env.PORT || 3456);

/** Resolve URL pathname to a file under `root` only (no path traversal). */
function resolveSafeStaticPath(pathname) {
	if (pathname.includes('\0')) return null;
	let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
	if (!rel) rel = 'index.html';
	let filePath = resolve(rootResolved, rel);
	if (pathname !== '/' && pathname.endsWith('/')) filePath = resolve(filePath, 'index.html');
	const relOut = relative(rootResolved, filePath);
	if (relOut === '..' || relOut.startsWith(`..${sep}`) || relOut.startsWith('..')) return null;
	return filePath;
}

function loadDotEnv() {
	for (const name of ['.env', '.env.local']) {
		const p = join(root, name);
		if (!existsSync(p)) continue;
		try {
			const raw = readFileSync(p, 'utf-8');
			for (const line of raw.split(/\r?\n/)) {
				const t = line.trim();
				if (!t || t.startsWith('#')) continue;
				const eq = t.indexOf('=');
				if (eq <= 0) continue;
				const key = t.slice(0, eq).trim();
				if (process.env[key] !== undefined) continue;
				let val = t.slice(eq + 1).trim();
				if (
					(val.startsWith('"') && val.endsWith('"')) ||
					(val.startsWith("'") && val.endsWith("'"))
				) {
					val = val.slice(1, -1);
				}
				process.env[key] = val;
			}
		} catch {
			/* ignore */
		}
	}
}
loadDotEnv();

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
};

async function readBody(req) {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	const raw = Buffer.concat(chunks).toString('utf8');
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function json(res, status, body) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
	res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
	const pathname = url.pathname;

	if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		});
		res.end();
		return;
	}

	if (pathname === '/api/furrow-chat') {
		const { handleFurrowChatPost, isAnyLlmConfigured } = await import('../server/furrow-chat-handler.ts');

		if (req.method === 'GET') {
			json(res, 200, {
				ok: true,
				llmConfigured: isAnyLlmConfigured(),
				agentEnabled: process.env.FURROW_AGENT_DISABLED !== '1',
				agentTools: process.env.FURROW_AGENT_TOOLS === '1',
			});
			return;
		}

		if (req.method === 'POST') {
			const body = await readBody(req);
			const result = await handleFurrowChatPost(body, { clientIp: '127.0.0.1' });
			if (result.ok) {
				json(res, 200, {
					reply: result.reply,
					agentMode: result.agentMode,
					actions: result.actions,
					knowledgeIds: result.knowledgeIds,
				});
			} else {
				json(res, result.status, { error: result.error, hint: result.hint });
			}
			return;
		}

		res.writeHead(405);
		res.end();
		return;
	}

	if (pathname === '/api/furrow-signals') {
		const { getFurrowMarketSignals, refreshFurrowMarketSignals } = await import(
			'../server/furrow-market-signals.ts'
		);
		if (req.method === 'GET') {
			const force = url.searchParams.get('force') === '1';
			const body = await getFurrowMarketSignals({ force });
			json(res, 200, body);
			return;
		}
		if (req.method === 'POST') {
			const body = await refreshFurrowMarketSignals();
			json(res, 200, body);
			return;
		}
		res.writeHead(405);
		res.end();
		return;
	}

	if (pathname === '/api/market-data' && req.method === 'GET') {
		const { default: handler } = await import('../api/market-data.ts');
		const vReq = { method: 'GET', query: {}, headers: req.headers };
		let status = 200;
		let body;
		const vRes = {
			status(c) {
				status = c;
				return vRes;
			},
			json(b) {
				body = b;
			},
			setHeader() {
				return vRes;
			},
			end() {},
		};
		await handler(vReq, vRes);
		json(res, status, body);
		return;
	}

	if (pathname === '/api/market-history' && req.method === 'GET') {
		const { default: handler } = await import('../api/market-history.ts');
		const sym = url.searchParams.get('symbol') || 'ZW=F';
		const vReq = { method: 'GET', query: { symbol: sym }, headers: req.headers };
		let status = 200;
		let body;
		const vRes = {
			status(c) {
				status = c;
				return vRes;
			},
			json(b) {
				body = b;
			},
			setHeader() {
				return vRes;
			},
			end() {},
		};
		await handler(vReq, vRes);
		json(res, status, body);
		return;
	}

	if (pathname === '/api/chat' && req.method === 'POST') {
		const { default: handler } = await import('../api/chat.ts');
		const parsed = await readBody(req);
		const vReq = {
			method: 'POST',
			body: parsed ?? {},
			headers: req.headers,
			socket: req.socket,
		};
		let status = 200;
		let body;
		const vRes = {
			status(c) {
				status = c;
				return vRes;
			},
			json(b) {
				body = b;
			},
			setHeader() {
				return vRes;
			},
			end() {},
		};
		await handler(vReq, vRes);
		json(res, status, body);
		return;
	}

	if (pathname === '/api/academy-tutor' && req.method === 'POST') {
		const { default: handler } = await import('../api/academy-tutor.ts');
		const parsed = await readBody(req);
		const vReq = {
			method: 'POST',
			body: parsed ?? {},
			headers: req.headers,
			socket: req.socket,
		};
		let status = 200;
		let body;
		const vRes = {
			status(c) {
				status = c;
				return vRes;
			},
			json(b) {
				body = b;
			},
			setHeader() {
				return vRes;
			},
			end() {},
		};
		await handler(vReq, vRes);
		json(res, status, body);
		return;
	}

	if (pathname === '/api/public-config' && req.method === 'GET') {
		const mailchimpUrl = (process.env.FURROW_MAILCHIMP_URL || '').trim();
		const mailchimpHidden = (process.env.FURROW_MAILCHIMP_HIDDEN || '').trim();
		const resendConfigured = Boolean(
			process.env.RESEND_API_KEY?.trim() &&
				process.env.RESEND_FROM?.trim() &&
				(process.env.FURROW_INBOX_EMAIL?.trim() || process.env.MAIL_TO?.trim()),
		);
		json(res, 200, {
			mailchimpConfigured: Boolean(mailchimpUrl && mailchimpHidden),
			mailchimpUrl: mailchimpUrl || null,
			mailchimpHidden: mailchimpHidden || null,
			waitlistResendConfigured: resendConfigured,
			waitlistApi: true,
			signalsApi: true,
		});
		return;
	}

	if (pathname === '/api/config' && req.method === 'GET') {
		const { default: handler } = await import('../api/config.ts');
		const vReq = { method: 'GET', headers: req.headers };
		let status = 200;
		let body;
		const vRes = {
			status(c) {
				status = c;
				return vRes;
			},
			json(b) {
				body = b;
			},
			setHeader() {
				return vRes;
			},
			end() {},
		};
		await handler(vReq, vRes);
		json(res, status, body);
		return;
	}

	if (pathname === '/api/waitlist' && req.method === 'POST') {
		const { submitFurrowWaitlist } = await import('../server/waitlist.ts');
		const body = (await readBody(req)) || {};
		const fullName =
			typeof body.full_name === 'string'
				? body.full_name
				: typeof body.name === 'string'
					? body.name
					: '';
		const email = typeof body.email === 'string' ? body.email : '';
		const interest = typeof body.interest === 'string' ? body.interest : 'all';
		const lang = body.lang === 'bg' || body.lang === 'ru' ? 'bg' : 'en';
		const source = typeof body.source === 'string' ? body.source : 'website';
		const result = await submitFurrowWaitlist({ fullName, email, interest, lang, source });
		if (!result.ok) {
			json(res, 400, { error: result.error });
			return;
		}
		const en = lang === 'en';
		json(res, 200, {
			ok: true,
			mailDelivery: result.mailDelivery,
			welcomeSent: result.welcomeSent,
			message: result.welcomeSent
				? en
					? 'Registered! Check your inbox for confirmation.'
					: 'Готово! Проверете имейла за потвърждение.'
				: en
					? 'You are on the list. We will contact you before launch.'
					: 'Вие сте в списъка. Ще пишем преди старт.',
		});
		return;
	}

	let staticPath = pathname;
	if (staticPath === '/agridirect') staticPath = '/agridirect/index.html';
	if (staticPath === '/register') staticPath = '/register.html';
	if (staticPath === '/login') staticPath = '/login.html';
	if (staticPath === '/archive') staticPath = '/archive.html';
	if (staticPath === '/analytics') staticPath = '/analytics.html';
	if (staticPath === '/bg/analytics') staticPath = '/bg/analytics.html';
	if (staticPath === '/market-intelligence') staticPath = '/market-intelligence.html';
	if (staticPath === '/bg/market-intelligence') staticPath = '/bg/market-intelligence.html';
	if (staticPath === '/egypt-fields-desert-oasis-2026') staticPath = '/egypt-fields-desert-oasis-2026.html';
	if (staticPath === '/egypt-fields-desert-oasis-2026-ru') staticPath = '/egypt-fields-desert-oasis-2026-ru.html';

	const filePath = resolveSafeStaticPath(staticPath);
	if (!filePath) {
		res.writeHead(403);
		res.end('Forbidden');
		return;
	}

	try {
		const data = await readFile(filePath);
		const ext = extname(filePath);
		res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end('Not found');
	}
});

server.listen(port, () => {
	console.log(`Furrow dev: http://127.0.0.1:${port}`);
	console.log(
		'APIs: /api/furrow-chat, /api/furrow-signals, /api/waitlist, /api/public-config, /api/market-data, /api/market-history, /api/chat, /api/academy-tutor',
	);
	console.log('Set MISTRAL_API_KEY in .env for AI; RESEND_* for waitlist email.');
});
