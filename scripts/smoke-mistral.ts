/**
 * Еднократна проверка: Mistral chat completions с ключ от .env
 * Изпълни: npx tsx scripts/smoke-mistral.ts
 */
import { config } from 'dotenv';
import { readMistralApiKey, readMistralModel } from '../lib/mistral-env';

config();

const key = readMistralApiKey();
if (!key) {
	console.error('FAIL: MISTRAL_API_KEY липсва или е празен в .env');
	process.exit(1);
}

const model = readMistralModel();
const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${key}`,
	},
	body: JSON.stringify({
		model,
		max_tokens: 40,
		messages: [{ role: 'user', content: 'Отговори с една дума: OK' }],
	}),
});

const raw = await res.text();
console.log('HTTP', res.status);
if (!res.ok) {
	console.error(raw.slice(0, 800));
	process.exit(1);
}
const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
const reply = data.choices?.[0]?.message?.content?.trim();
console.log('Model:', model);
console.log('Reply:', reply ?? '(празно)');
console.log('OK: Mistral отговори успешно.');
