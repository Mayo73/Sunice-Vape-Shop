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

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
