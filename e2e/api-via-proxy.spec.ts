import { test, expect } from '@playwright/test';

/**
 * Vite проксира `/api` към `DEV_API_PORT` (по подразбиране 8788).
 * Ако за E2E не се стартира dev API (`E2E_SKIP_DEV_API=1`), тези тестове ще паднат —
 * тогава няма процес зад проксито (ECONNREFUSED / 5xx).
 */
test.describe('API през Vite preview', () => {
	test('GET /api/chat — JSON здраве', async ({ request }) => {
		const res = await request.get('/api/chat');
		expect(res.ok(), `очаква се 200 от dev-server зад проксито; статус ${res.status()}`).toBeTruthy();
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.ok).toBe(true);
		expect(body).toHaveProperty('llmConfigured');
		expect(typeof body.llmConfigured).toBe('boolean');
	});

	test('GET /api — списък маршрути', async ({ request }) => {
		const res = await request.get('/api');
		expect(res.ok()).toBeTruthy();
		const body = (await res.json()) as { ok?: boolean; routes?: unknown };
		expect(body.ok).toBe(true);
		expect(Array.isArray(body.routes)).toBeTruthy();
	});
});
