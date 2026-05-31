import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isAndroid = mode === 'android';

  // Уникальный идентификатор сборки. Зашивается в бандл (__BUILD_ID__) и
  // одновременно пишется в dist/version.json. Фронт периодически сравнивает
  // их и предлагает обновиться, когда на сервере появилась новая версия.
  const buildId = env.BUILD_ID || String(Date.now());

  return {
    plugins: [
      react(),
      {
        // Кладём version.json рядом с бандлом — это «маяк» свежести,
        // который читают и web, и PWA, и нативный APK (через server.url).
        name: 'masteruz-build-version',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ buildId }),
          });
        },
      },
    ],
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
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
