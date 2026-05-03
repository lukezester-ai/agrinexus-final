import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
});
