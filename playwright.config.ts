import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, '.env.local'), override: true });

const port = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);
const host = process.env.PLAYWRIGHT_PREVIEW_HOST || '127.0.0.1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;

const rawApi = String(process.env.DEV_API_PORT || process.env.PORT || '').trim();
const apiPort =
	Number.isFinite(Number(rawApi)) && Number(rawApi) > 0 ? Number(rawApi) : 8788;

const startDevApi = process.env.E2E_SKIP_DEV_API !== '1';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		viewport: { width: 1280, height: 800 },
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: startDevApi
		? [
				{
					command: 'npx tsx server/dev-server.ts',
					url: `http://127.0.0.1:${apiPort}/`,
					reuseExistingServer: !process.env.CI,
					timeout: 90_000,
					stdout: 'pipe',
					stderr: 'pipe',
					env: {
						...process.env,
						PORT: String(apiPort),
						DEV_API_PORT: String(apiPort),
					},
				},
				{
					command: `npm run preview -- --host ${host} --port ${port} --strictPort`,
					url: baseURL,
					reuseExistingServer: !process.env.CI,
					timeout: 120_000,
					stdout: 'pipe',
					stderr: 'pipe',
				},
			]
		: {
				command: `npm run preview -- --host ${host} --port ${port} --strictPort`,
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
				stdout: 'pipe',
				stderr: 'pipe',
			},
});
