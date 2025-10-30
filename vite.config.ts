import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/pwa-app/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Оптимизации для Lighthouse
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'utils-vendor': ['date-fns', 'dexie', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Удаляем console.log в production (через esbuild)
    minify: 'esbuild',
  },
  plugins: [
    react({
      // Отключаем проверку React DevTools hook для Fast Refresh
      // Это предотвращает предупреждение о переопределении хука
      jsxRuntime: 'automatic',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Смена+ v0.5 b',
        short_name: 'Смена+',
        description: 'PWA приложение для расчета заработной платы',
        theme_color: '#2196F3',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/pwa-app/',
        scope: '/pwa-app/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
          // maskable варианты можно добавить позже:
          // { src: 'pwa-192x192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          // { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/pwa-app/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  }
})

