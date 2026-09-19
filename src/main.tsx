import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Latin subsets only. The full @fontsource entrypoints pull in Cyrillic, Greek
// and Vietnamese too, which nearly doubled what a phone had to download before
// the first screen appeared.
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'

import './styles/theme.css'
import './styles/app.css'
import App from './App'
import { isIOS } from './lib/push'

// iPhones only deliver push to the Home Screen app, and that app opens on the
// manifest's start_url -- the shop, not the order on screen. Without a
// start_url the standard falls back to the page being added, so on iOS the
// link points at a manifest that has none (built in vite.config.ts): adding
// the order page to the Home Screen installs an app that opens on that order.
if (isIOS()) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (link) link.href = `${import.meta.env.BASE_URL}manifest-ios.webmanifest`
}

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
