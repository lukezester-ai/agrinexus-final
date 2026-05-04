import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const raw = env.DEV_API_PORT ?? process.env.DEV_API_PORT;
  const n = raw !== undefined && String(raw).trim() !== '' ? Number(raw) : NaN;
  const apiPort = Number.isFinite(n) && n > 0 ? n : 8788;

  return {
    define: {
      /** За UI подсказки при офлайн API — синхрон с proxy към dev-server */
      'import.meta.env.VITE_DEV_API_PORT': JSON.stringify(String(apiPort)),
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom')) return 'react-dom';
            if (id.includes('node_modules/react/')) return 'react';
            if (id.includes('node_modules/recharts')) return 'recharts';
            if (id.includes('node_modules/lucide-react')) return 'lucide';
            if (id.includes('node_modules/@supabase')) return 'supabase';
            if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
            return undefined;
          },
        },
      },
    },
    server: {
      // Отделен порт от Next.js `agrinexus-mvp` (обикновено :3002). Без strictPort=false Vite прескача на :3002 и показва „грешния“ проект.
      port: 5173,
      strictPort: true,
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
