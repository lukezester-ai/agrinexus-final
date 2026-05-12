import {
	chatProviderLabel,
	openAIMessageContentToString,
	resolveTextChatUpstream,
} from './llm-routing.js';

export type FieldlotChatTurn = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 2800;
const MAX_REPLY_CHARS = 4000;

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max)}\n…`;
}

const FIELDLOT_SYSTEM = `Ти си „Fieldlot Guide“ — LLM асистент за концепцията **Fieldlot** (field + lot — партиди от полето): български B2B каталог за агро оферти (производители ↔ купувачи), ранна фаза **без** escrow и без плащания през платформата.

Контекст: **Fieldlot** е публична страница в екосистемата **AgriNexus**. Водещото работно приложение е **AgriNexus** (началото на сайта, път \`/\` на същия домейн). За официални въпроси към екипа насочвай към **info@agrinexus.eu** — ти не заместваш екипа.

Правила:
- Отговаряй на **български**. Ясно и полезно: обикновено 3–10 изречения, освен ако потребителят иска повече структура.
- В обхват: как би работела такава платформа, как да се опише оферта, какво да подготви производител или купувач, общи съвети за доверие, комуникация и преговори в агро сектора в **България**.
- Извън обхват: конкретни „официални“ пазарни цени в реално време, правни заключения, митнически процедури — кажи че не можеш да гарантираш и насочи към специалист или институция.
- **Не измисляй** функции извън описаното: няма escrow, няма задържане на пари от Fieldlot, няма арбитраж в първата фаза.
- Без огради от код (no markdown fences). Можеш кратки списъци с тире или номера.`;

function isTurn(v: unknown): v is FieldlotChatTurn {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string';
}

export async function handleFieldlotChatPost(
	rawBody: unknown,
): Promise<
	{ ok: true; reply: string } | { ok: false; status: number; error: string; hint?: string }
> {
	const upstream = resolveTextChatUpstream('chat');
	if (!upstream) {
		return {
			ok: false,
			status: 503,
			error: 'LLM не е конфигуриран',
			hint: 'Задай MISTRAL_API_KEY, OPENAI_API_KEY или локален OLLAMA_BASE_URL в .env и рестартирай dev сървъра.',
		};
	}

	if (!rawBody || typeof rawBody !== 'object') {
		return { ok: false, status: 400, error: 'Невалидно JSON тяло' };
	}

	const body = rawBody as Record<string, unknown>;
	const messagesRaw = body.messages;
	if (!Array.isArray(messagesRaw)) {
		return { ok: false, status: 400, error: 'messages трябва да е масив' };
	}

	const cleaned: FieldlotChatTurn[] = [];
	for (const m of messagesRaw.slice(-MAX_MESSAGES)) {
		if (!isTurn(m)) continue;
		const content = truncate(m.content.trim(), MAX_MESSAGE_CHARS);
		if (!content) continue;
		cleaned.push({ role: m.role, content });
	}

	if (cleaned.length === 0) {
		return { ok: false, status: 400, error: 'Няма валидни съобщения' };
	}

	const last = cleaned[cleaned.length - 1];
	if (last.role !== 'user') {
		return { ok: false, status: 400, error: 'Последното съобщение трябва да е от потребителя' };
	}

	const chatMessages = [
		{ role: 'system' as const, content: FIELDLOT_SYSTEM },
		...cleaned.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
	];

	const temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.45);
	const safeTemp = Number.isFinite(temperature) ? Math.min(1.1, Math.max(0, temperature)) : 0.45;

	const payload: Record<string, unknown> = {
		model: upstream.model,
		temperature: safeTemp,
		max_tokens: 950,
		messages: chatMessages,
	};

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (upstream.bearer) {
		headers.Authorization = `Bearer ${upstream.bearer}`;
	}

	let res: Response;
	try {
		res = await fetch(upstream.completionUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
		});
	} catch {
		const label = chatProviderLabel(upstream.provider);
		return {
			ok: false,
			status: 502,
			error: `Мрежова грешка към ${label}`,
			hint:
				upstream.provider === 'ollama'
					? 'Пусни Ollama (ollama serve) и провери OLLAMA_BASE_URL.'
					: undefined,
		};
	}

	const raw = await res.text();
	let data: { error?: { message?: string }; choices?: { message?: { content?: unknown } }[] };
	try {
		if (!raw.trim()) {
			return {
				ok: false,
				status: 502,
				error: 'Празен отговор от LLM',
				hint: 'Провери ключа и името на модела.',
			};
		}
		data = JSON.parse(raw) as typeof data;
	} catch {
		return {
			ok: false,
			status: 502,
			error: 'Невалиден JSON от LLM',
			hint: 'Провери доставчика и логовете.',
		};
	}

	if (!res.ok) {
		const detail = data.error?.message || res.statusText || 'Upstream error';
		return {
			ok: false,
			status: res.status >= 400 && res.status < 600 ? res.status : 502,
			error: detail,
		};
	}

	const rawReply = openAIMessageContentToString(data.choices?.[0]?.message?.content);
	if (!rawReply) {
		return { ok: false, status: 502, error: 'Празно съдържание от модела' };
	}

	return { ok: true, reply: truncate(rawReply.trim(), MAX_REPLY_CHARS) };
}
