import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'public'),
  envDir: resolve(import.meta.dirname),
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'public/index.html'),
        admin: resolve(import.meta.dirname, 'public/admin.html'),
        dashboard: resolve(import.meta.dirname, 'public/dashboard.html')
      }
    }
  },
  server: {
    fs: { allow: [resolve(import.meta.dirname)] }
  }
});