/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createWorkerSource } from './src/features/pwa/serviceWorker.ts';

export default defineConfig({
  plugins: [react(), {
    name: 'sol-portal-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(path => path.startsWith('assets/') && !path.endsWith('.map')).map(path => '/' + path);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: createWorkerSource(Date.now().toString(36), assets) });
    },
  }],
  test: {
    environment: 'happy-dom',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
