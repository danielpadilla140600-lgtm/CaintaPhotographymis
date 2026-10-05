import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
/// <reference types="vitest" />

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'node',
      globals: true,
    },
    // Pre-bundle all heavy dependencies at startup so the first browser
    // request is fast (instead of triggering a slow on-demand bundle).
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'motion/react',
        'recharts',
        'leaflet',
        'lucide-react',
        '@hello-pangea/dnd',
        'jspdf',
      ],
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // db.json is runtime data and must not reload the client after API writes.
      watch: {
        ignored: ['**/db.json'],
      },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      ...(process.env.DISABLE_HMR === 'true' ? { watch: null } : {}),
    },
  };
});
