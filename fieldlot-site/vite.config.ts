import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, loadEnv } from 'vite';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig(({ mode }) => {
	const loaded = loadEnv(mode, process.cwd(), '');
	const raw = loaded.FIELDLOT_API_PORT || process.env.FIELDLOT_API_PORT || '8789';
	const n = Number(String(raw).trim());
	const apiPort = Number.isFinite(n) && n > 0 ? n : 8789;

	return {
		root: '.',
		appType: 'mpa',
		server: {
			port: 5174,
			strictPort: true,
			open: true,
			host: true,
			proxy: {
				'/api': {
					target: `http://127.0.0.1:${apiPort}`,
					changeOrigin: true,
				},
			},
		},
		preview: {
			port: 5174,
			strictPort: true,
			host: true,
			proxy: {
				'/api': {
					target: `http://127.0.0.1:${apiPort}`,
					changeOrigin: true,
				},
			},
		},
	};
});
