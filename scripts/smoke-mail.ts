/**
 * Тест на изходящ имейл (Resend или SMTP от .env)
 * npm run test:mail
 */
import { config } from 'dotenv';
import { sendInboundNotification } from '../lib/email';

for (const k of [
	'RESEND_API_KEY',
	'MAIL_FROM',
	'MAIL_TO',
	'CONTACT_TO_EMAIL',
	'AGRI_INBOX_EMAIL',
	'RESEND_FROM',
	'SMTP_HOST',
	'SMTP_USER',
	'SMTP_PASS',
	'SMTP_FROM',
]) {
	delete process.env[k];
}
config();

const r = await sendInboundNotification({
	subject: '[AgriNexus smoke] тестова поща',
	html: '<p>Smoke test от <code>scripts/smoke-mail.ts</code></p>',
});

if (r.status === 'sent') {
	console.log('OK: имейлът е изпратен през Resend/SMTP.');
	process.exit(0);
}

if (r.status === 'skipped') {
	console.log(
		r.reason === 'not_configured'
			? 'SKIP: Задайте RESEND_API_KEY + MAIL_FROM, или SMTP_HOST (+ MAIL_FROM). MAIL_TO по желание.'
			: 'SKIP:',
		r,
	);
	process.exit(2);
}

console.error('FAIL:', r.error);
process.exit(1);
