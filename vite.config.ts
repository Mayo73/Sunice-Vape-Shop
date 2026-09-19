import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa'

// Where the app is mounted: "/" on its own domain, or a sub-path such as
// "/shop/" when it shares a domain with another site behind a reverse proxy.
// Accepts "shop", "/shop" or "/shop/" and always yields "/shop/"; unset is "/".
function normalizeBase(raw: string | undefined): string {
  const inner = (raw ?? '').trim().replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}

// iPhones only deliver push to the Home Screen app, and that app opens on the
// manifest's start_url -- the shop, not the order the customer is looking at.
// The standard falls back to the page being added when start_url is absent, so
// iOS gets a second manifest without it (src/main.tsx swaps the link): adding
// the order page to the Home Screen then installs an app that opens on that
// very order, where "Notify me" is waiting. Android keeps the full manifest,
// because Chrome will not offer to install without a start_url.
function iosManifest(manifest: Partial<ManifestOptions>): Plugin {
  const { start_url: _omitted, ...rest } = manifest
  return {
    name: 'sunice:ios-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest-ios.webmanifest', source: JSON.stringify(rest) })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env: this file is typechecked with the app,
  // which has no Node types. An empty prefix makes every variable visible here
  // only -- nothing beyond VITE_* reaches the client bundle.
  const base = normalizeBase(loadEnv(mode, '.', '').BASE_PATH)

  const manifest: Partial<ManifestOptions> = {
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
  }

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // The worker is hand-written (src/sw.ts) because it handles push;
        // the plugin only injects the precache list and bundles it.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest,
        injectManifest: {
          // woff2 only -- @fontsource also emits legacy .woff, which nothing that can
          // run this app would request, so it stays out of the precache.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
      }),
      iosManifest(manifest),
    ],
    build: {
      target: 'es2022',
    },
  }
})
