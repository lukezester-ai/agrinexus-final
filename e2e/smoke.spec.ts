import { test, expect } from '@playwright/test';

test.describe('SPA smoke', () => {
	test('landing shows AgriNexus wordmark', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('main#main-content')).toBeVisible();
		await expect(page.locator('h1.brand-wordmark')).toBeVisible();
		await expect(page.locator('h1.brand-wordmark')).toContainText(/Agri/i);
	});

	test('open AI assistant from nav', async ({ page }) => {
		await page.goto('/');
		const assistant = page.getByRole('button', { name: /AI помощник|AI assistant/i });
		await assistant.click();
		await expect(
			page.getByRole('heading', { name: /Помощник с водещ RAG|RAG-led assistant/i }),
		).toBeVisible();
	});

	test('/fieldlot redirects to fieldlot landing', async ({ page }) => {
		const res = await page.goto('/fieldlot', { waitUntil: 'commit' });
		expect(res?.status() === 200 || res?.status() === 302).toBeTruthy();
		await expect(page).toHaveURL(/fieldlot\.html/);
	});
});
