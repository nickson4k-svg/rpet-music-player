import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Rpet Music Player',
        short_name: 'Rpet',
        description: 'A modern local music player with audio reactive background',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  build: {
    // Rely on Vite's default chunking strategy which is well optimized
  },
  server: {
    proxy: {
      '/api/soundcloud': {
        target: 'https://api-v2.soundcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/soundcloud/, ''),
      },
      '/api/soundcloud-html': {
        target: 'https://soundcloud.com',
        changeOrigin: true,
        rewrite: () => '/',
      },
      '/api/audius-proxy': {
        target: 'https://discoveryprovider.audius.co',
        changeOrigin: true,
        followRedirects: true,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (_proxyRes, _req, res) => {
            // Add permissive CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            
            // If it's a redirect, we rewrite the Location header so the browser follows it through our proxy again!
            // Wait, proxying S3 bucket streams through localhost might be complex to rewrite.
            // Let's just use the redirect, but the browser will hit S3 and S3 might block it.
          });
        },
        rewrite: (path) => {
          const trackId = new URL(path, 'http://localhost').searchParams.get('id');
          return `/v1/tracks/${trackId}/stream?app_name=Rpet`;
        }
      }
    }
  }
});
