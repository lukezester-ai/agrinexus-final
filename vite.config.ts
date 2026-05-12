import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, loadEnv, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const cwd = process.cwd();

/** Кратък URL към `public/fieldlot.html` (лендинг под AgriNexus). */
function fieldlotLandingRedirectMiddleware() {
	return (
		req: { method?: string; url?: string },
		res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void },
		next: () => void,
	) => {
		const raw = req.url?.split('?')[0] ?? '';
		const targets = new Set(['/fieldlot', '/fieldlot/']);
		if (req.method === 'GET' && targets.has(raw)) {
			res.statusCode = 302;
			res.setHeader('Location', '/fieldlot.html');
			res.end();
			return;
		}
		next();
	};
}

function attachFieldlotRedirectEarly(server: ViteDevServer | PreviewServer): void {
	const handle = fieldlotLandingRedirectMiddleware();
	if (Array.isArray(server.middlewares.stack)) {
		server.middlewares.stack.unshift({ route: '', handle });
	} else {
		server.middlewares.use(handle);
	}
}

// Синхрон с dev-server: да има DEV_API_PORT преди proxy/define (loadEnv понякога не хваща .env навреме на Windows).
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, '.env.local'), override: true });

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, cwd, '');
  const raw =
    (loaded.DEV_API_PORT && String(loaded.DEV_API_PORT).trim()) ||
    (process.env.DEV_API_PORT && String(process.env.DEV_API_PORT).trim()) ||
    '';
  const n = raw !== '' ? Number(raw) : NaN;
  const apiPort = Number.isFinite(n) && n > 0 ? n : 8788;

  return {
    define: {
      /** За UI подсказки при офлайн API — синхрон с proxy към dev-server */
      'import.meta.env.VITE_DEV_API_PORT': JSON.stringify(String(apiPort)),
    },
    plugins: [
      {
        name: 'fieldlot-landing-redirect-early',
        enforce: 'pre',
        configureServer(server) {
          return () => attachFieldlotRedirectEarly(server);
        },
        configurePreviewServer(server) {
          return () => attachFieldlotRedirectEarly(server);
        },
      },
      react(),
    ],
    build: {
      /** App shell stays large (many routes in App.tsx); Chart.js alone tips default 500 kB warning */
      chunkSizeWarningLimit: 850,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom')) return 'react-dom';
            if (id.includes('node_modules/react/')) return 'react';
            if (id.includes('node_modules/recharts')) return 'recharts';
            if (id.includes('node_modules/lucide-react')) return 'lucide';
            if (id.includes('node_modules/@supabase')) return 'supabase';
            if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
            if (id.includes('node_modules/chart.js')) return 'chartjs';
            if (id.includes('node_modules/react-chartjs-2')) return 'chartjs';
            return undefined;
          },
        },
      },
    },
    server: {
      /** Позволява отваряне от телефон в същата Wi‑Fi мрежа (http://<PC-IP>:5173/). */
      host: true,
      // Отделен порт от Next.js `agrinexus-mvp` (обикновено :3002). Без strictPort=false Vite прескача на :3002 и показва „грешния“ проект.
      port: 5173,
      strictPort: true,
      /** Стартиране с `npm run dev` отваря браузър на :5173 (ръчно: http://localhost:5173/). */
      open: true,
      // Същият порт като server/dev-server.ts (DEV_API_PORT в .env).
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
