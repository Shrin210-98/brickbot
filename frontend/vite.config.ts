/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Service worker: see docs/pwa.md. Every runtime rule is listed explicitly;
// anything not matched here (chat, admin, auth, inquiries, any non-GET) goes
// straight to the network. The urlPattern functions are serialized into the
// generated sw.js, so they can't use anything from this file's scope.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'script-defer',
  // public/manifest.webmanifest is linked from index.html by hand.
  manifest: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/profile',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-profile',
          expiration: { maxEntries: 1, maxAgeSeconds: HOUR },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // The list is keyed by its full URL, so each filter combination is its own entry.
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin &&
          ['/api/listings', '/api/listings/featured', '/api/listings/facets', '/api/testimonials'].includes(
            url.pathname,
          ),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-lists',
          expiration: { maxEntries: 50, maxAgeSeconds: 5 * MINUTE },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && /^\/api\/listings\/[^/]+$/.test(url.pathname) && !/\/(featured|facets)$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-listing-detail',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: DAY },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // Images only: videos are fetched with Range requests, which don't cache.
        urlPattern: ({ url, request, sameOrigin }) =>
          sameOrigin &&
          request.destination === 'image' &&
          (url.pathname.startsWith('/media/') || url.pathname.startsWith('/images/')),
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * DAY },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // Fonts come from Google Fonts (index.html), so they're cached here, not precached.
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-css' },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 365 * DAY },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/media': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
