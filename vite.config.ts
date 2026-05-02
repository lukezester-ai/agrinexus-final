import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Отделен порт от Next.js `agrinexus-mvp` (обикновено :3002). Без strictPort=false Vite прескача на :3002 и показва „грешния“ проект.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
});
