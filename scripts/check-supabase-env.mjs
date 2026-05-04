import 'dotenv/config';

const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
	console.error('FAIL: Липсват VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY в .env');
	process.exit(1);
}

const hostOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
if (!hostOk) {
	console.error('FAIL: VITE_SUPABASE_URL трябва да е https://<ref>.supabase.co');
	process.exit(1);
}

console.log('OK: И двата променливи са зададени; URL домейнът е *.supabase.co');
console.log('Дължина на ключ (символи):', key.length, '(JWT anon обикновено 150+ символа)');

const baseUrl = url.replace(/\/$/, '');

try {
	const settings = await fetch(`${baseUrl}/auth/v1/settings`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` },
	});
	console.log('auth/v1/settings HTTP:', settings.status, settings.ok ? '(валиден anon JWT)' : '');
	if (!settings.ok) {
		console.error(
			'FAIL: anon ключът не минава през Auth API. Провери Legacy anon и че URL е от същия проект.',
		);
		process.exit(1);
	}
} catch (e) {
	console.error('FAIL: Няма връзка до Auth API:', e?.message ?? e);
	process.exit(1);
}

try {
	const probe = await fetch(
		`${baseUrl}/rest/v1/operations_hub_workspace?select=user_id&limit=1`,
		{
			headers: { apikey: key, Authorization: `Bearer ${key}` },
		},
	);
	console.log('REST operations_hub_workspace HTTP:', probe.status);
	const txt = await probe.text();
	if (probe.status === 401) {
		console.error('FAIL: PostgREST отхвърля ключа за таблични заявки.');
		process.exit(1);
	}
	if (probe.status === 404 && txt.includes('PGRST205')) {
		console.warn(
			'Таблица operations_hub_workspace липсва — пусни data/supabase-operations-hub-workspace.sql в SQL Editor.',
		);
	} else if (probe.ok || probe.status === 403 || probe.status === 406) {
		console.log('PostgREST приема ключа за таблични заявки.');
	}
} catch (e) {
	console.error('FAIL: REST проба:', e?.message ?? e);
	process.exit(1);
}
