import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Where the app is mounted: "/" on its own domain, or a sub-path such as
// "/shop/" when it shares a domain with another site behind a reverse proxy.
// Accepts "shop", "/shop" or "/shop/" and always yields "/shop/"; unset is "/".
function normalizeBase(raw: string | undefined): string {
  const inner = (raw ?? '').trim().replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}

export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env: this file is typechecked with the app,
  // which has no Node types. An empty prefix makes every variable visible here
  // only -- nothing beyond VITE_* reaches the client bundle.
  const base = normalizeBase(loadEnv(mode, '.', '').BASE_PATH)

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Sunice Vape Shop',
          short_name: 'Sunice',
          description: 'Order for pickup. Cash only.',
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b0713',
          theme_color: '#0b0713',
          icons: [
            { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // woff2 only -- @fontsource also emits legacy .woff, which nothing that can
          // run this app would request, so it stays out of the precache.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          cleanupOutdatedCaches: true,
          // The shell may be cached; live data must never be. An order status or a
          // countdown served from cache would be actively misleading, so every
          // Supabase call is kept off the service worker entirely.
          navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//, /^\/realtime\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    build: {
      target: 'es2022',
    },
  }
})
