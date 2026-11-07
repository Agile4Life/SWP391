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
      const precache = new Set<string>();
      const addChunk = (name: string) => {
        if (name.includes('three-vendor') || name.includes('ExplorePage')) return;
        const chunk = bundle[name];
        if (chunk?.type !== 'chunk' || precache.has('/' + name)) return;
        precache.add('/' + name);
        chunk.imports.forEach(addChunk);
      };
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.isEntry) addChunk(file.fileName);
        if (
          file.fileName.endsWith('.css') &&
          !file.fileName.includes('ExplorePage') &&
          !file.fileName.includes('explore3d')
        ) {
          precache.add('/' + file.fileName);
        }
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: createWorkerSource(Date.now().toString(36), assets, [...precache]) });
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (
            normalized.includes('node_modules/react/') ||
            normalized.includes('node_modules/react-dom/') ||
            normalized.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (normalized.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          if (
            normalized.includes('node_modules/three') ||
            normalized.includes('node_modules/@react-three/') ||
            normalized.includes('node_modules/camera-controls') ||
            normalized.includes('node_modules/troika-') ||
            normalized.includes('node_modules/three-mesh-bvh') ||
            normalized.includes('node_modules/three-stdlib') ||
            normalized.includes('node_modules/maath') ||
            normalized.includes('node_modules/meshline')
          ) {
            return 'three-vendor';
          }
        },
      },
    },
  },
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
