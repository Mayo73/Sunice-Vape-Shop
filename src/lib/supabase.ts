import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and rebuild -- Vite inlines these at build time.',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    // Only admins ever sign in, and they should stay signed in between shifts.
    persistSession: true,
    autoRefreshToken: true,
    // No magic-link or OAuth redirects in this app, so nothing to parse from the URL.
    detectSessionInUrl: false,
  },
})

/** Public URL for an image in the product-images bucket. */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
