const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
import { Langfuse } from "langfuse-node";

const isLangfuseConfigured = Boolean(process.env.LANGFUSE_SECRET_KEY);
const langfuse = isLangfuseConfigured ? new Langfuse({
	publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY,
	secretKey: process.env.LANGFUSE_SECRET_KEY,
	baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_HOST || process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
}) : null;


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
	traceId?: string;
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
	
	let traceId: string | undefined;
	let generation: any;

	if (isLangfuseConfigured && langfuse) {
		const trace = langfuse.trace({
			name: "Mistral Chat",
		});
		traceId = trace.id;
		generation = trace.generation({
			name: "Mistral Completion",
			model,
			modelParameters: { 
				temperature: opts.temperature ?? 0.35, 
				maxTokens: opts.maxTokens ?? 280 
			},
			input: [
				{ role: "system", content: opts.system },
				{ role: "user", content: opts.user },
			],
		});
	}

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
			const errorMsg = body.slice(0, 120) || `HTTP ${res.status}`;
			console.warn("[mistral]", res.status, body.slice(0, 200));
			if (generation) {
				generation.end({ level: "ERROR", statusMessage: errorMsg });
				await langfuse?.flushAsync();
			}
			return {
				text: null,
				status: res.status,
				error: errorMsg,
				traceId,
			};
		}

		const data = (await res.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const text = data.choices?.[0]?.message?.content?.trim() || null;
		
		if (generation) {
			generation.end({ output: text });
			await langfuse?.flushAsync();
		}

		return { text, status: res.status, traceId };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.warn("[mistral]", msg);
		if (generation) {
			generation.end({ level: "ERROR", statusMessage: msg });
			await langfuse?.flushAsync();
		}
		return { text: null, status: 0, error: msg, traceId };
	}
}
