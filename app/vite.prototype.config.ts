// Standalone browser prototype for playtesting, outside Devvit.
//   npm run prototype        → dev server on http://localhost:5174
//   npm run prototype:build  → static files in dist/prototype
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'prototype',
  base: './',
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  // Inline the fonts too, so the single-file artifact page needs nothing else.
  build: {
    outDir: '../dist/prototype',
    emptyOutDir: true,
    assetsInlineLimit: 100_000,
  },
});
