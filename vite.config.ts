import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'livekit-dev-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/livekit-token')) {
              try {
                const { AccessToken } = await import('livekit-server-sdk');
                const url = new URL(req.url, 'http://localhost');
                const roomName = url.searchParams.get('roomName') || 'room-default';
                const participantName = url.searchParams.get('participantName') || 'Guest';
                const isHost = url.searchParams.get('isHost') === 'true';

                const apiKey = (env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY || 'APIFT7Qzne74nQ4').trim();
                const apiSecret = (env.LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET || 'PV6w7tfGYuCDUevqc1veQjHRAnRnLAFqIXSTXirypKiA').trim();
                const livekitUrl = (env.LIVEKIT_URL || process.env.LIVEKIT_URL || 'wss://rpet-music-ayo8mv0c.livekit.cloud').trim();

                const cleanIdentity = String(participantName).trim().replace(/[^a-zA-Z0-9_ -]/g, '_');
                const cleanRoom = String(roomName).trim().replace(/[^a-zA-Z0-9_-]/g, '_');

                const at = new AccessToken(apiKey, apiSecret, {
                  identity: cleanIdentity,
                  name: cleanIdentity,
                  ttl: '6h',
                });

                at.addGrant({
                  roomJoin: true,
                  room: cleanRoom,
                  canPublish: Boolean(isHost),
                  canSubscribe: true,
                  canPublishData: true,
                });

                const token = await at.toJwt();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  token,
                  livekitUrl,
                  roomName: cleanRoom,
                  participantName: cleanIdentity,
                  isHost: Boolean(isHost),
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Dev token generation failed' }));
                return;
              }
            }
            next();
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons.svg'],
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
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*(?:sndcdn\.com|creatornode\.audius\.co|jiosaavn\.com|saavncdn\.com).*\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'rpet-cover-art-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/livekit-client')) {
              return 'vendor-livekit';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/@hello-pangea/dnd')) {
              return 'vendor-dnd';
            }
          },
        },
      },
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
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            });
          },
          rewrite: (path) => {
            const trackId = new URL(path, 'http://localhost').searchParams.get('id');
            return `/v1/tracks/${trackId}/stream?app_name=Rpet`;
          }
        }
      }
    }
  };
});
