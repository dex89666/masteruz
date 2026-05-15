import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isAndroid = mode === 'android';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // В Android-режиме base должен быть ./ (относительный путь для WebView)
    base: isAndroid ? './' : '/',
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
      proxy: isAndroid
        ? {}
        : {
            '/api': {
              target: 'http://localhost:3001',
              changeOrigin: true,
            },
            '/uploads': {
              target: 'http://localhost:3001',
              changeOrigin: true,
            },
          },
    },
  };
});
