const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

export function isMistralConfigured(): boolean {
	return Boolean(process.env.MISTRAL_API_KEY?.trim());
}

export function mistralModel(envKey: string, fallback = "mistral-small-latest"): string {
	return process.env[envKey]?.trim() || fallback;
}

export type MistralChatResult = {
	text: string | null;
	status: number;
	error?: string;
};

export async function mistralChat(opts: {
	system: string;
	user: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
}): Promise<MistralChatResult> {
	const key = process.env.MISTRAL_API_KEY?.trim();
	if (!key) {
		return { text: null, status: 0, error: "MISTRAL_API_KEY not set" };
	}

	const model = opts.model?.trim() || mistralModel("MISTRAL_MESH_MODEL");

	try {
		const res = await fetch(MISTRAL_CHAT_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				temperature: opts.temperature ?? 0.35,
				max_tokens: opts.maxTokens ?? 280,
				messages: [
					{ role: "system", content: opts.system },
					{ role: "user", content: opts.user },
				],
			}),
			signal: AbortSignal.timeout(opts.timeoutMs ?? 28_000),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			console.warn("[mistral]", res.status, body.slice(0, 200));
			return {
				text: null,
				status: res.status,
				error: body.slice(0, 120) || `HTTP ${res.status}`,
			};
		}

		const data = (await res.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const text = data.choices?.[0]?.message?.content?.trim() || null;
		return { text, status: res.status };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.warn("[mistral]", msg);
		return { text: null, status: 0, error: msg };
	}
}
