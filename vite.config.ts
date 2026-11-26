/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', sourcemap: false, outDir: mode === 'artifact' ? 'dist-artifact' : 'dist' },
  test: {
    env: { VITE_AI_FREE_LIMIT: 'on' }, environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
}));
