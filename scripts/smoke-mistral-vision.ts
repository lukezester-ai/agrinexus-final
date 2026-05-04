/**
 * Smoke test: Mistral vision (Pixtral) с малко PNG от .env
 * npm run test:mistral:vision
 */
import { config } from 'dotenv';
import { readMistralApiKey, readMistralVisionModel } from '../lib/mistral-env';

delete process.env.MISTRAL_API_KEY;
delete process.env.MISTRAL_MODEL;
delete process.env.MISTRAL_VISION_MODEL;
config();

const key = readMistralApiKey();
if (!key) {
	console.error('FAIL: MISTRAL_API_KEY липсва или е празен в .env');
	process.exit(1);
}

const model = readMistralVisionModel();
/** Минимално PNG 1×1 пиксел (червен) — достатъчно за проверка на vision endpoint */
const pngBase64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const dataUrl = `data:image/png;base64,${pngBase64}`;

const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${key}`,
	},
	body: JSON.stringify({
		model,
		max_tokens: 80,
		temperature: 0.2,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: 'Какъв е доминиращият цвят на изображението? Отговори с една дума на български.',
					},
					{ type: 'image_url', image_url: dataUrl },
				],
			},
		],
	}),
});

const raw = await res.text();
console.log('HTTP', res.status);
console.log('Vision model:', model);
if (!res.ok) {
	console.error(raw.slice(0, 1200));
	process.exit(1);
}

const data = JSON.parse(raw) as { choices?: { message?: { content?: unknown } }[] };
const msg = data.choices?.[0]?.message?.content;
const reply =
	typeof msg === 'string'
		? msg.trim()
		: Array.isArray(msg)
			? msg
					.filter((p): p is { type?: string; text?: string } => p != null && typeof p === 'object')
					.map((p) => (p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
					.join('')
					.trim()
			: '';

console.log('Reply:', reply || '(празно)');
console.log('OK: Mistral vision отговори успешно.');
