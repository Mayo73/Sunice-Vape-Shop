import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { usePolling } from '../lib/hooks'
import type { ShopSettings } from '../lib/types'

interface ShopValue extends ShopSettings {
  ready: boolean
  refresh: () => void
}

const ShopContext = createContext<ShopValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>({ is_paused: false, paused_message: '' })
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('shop_settings')
      .select('is_paused, paused_message')
      .eq('id', 1)
      .maybeSingle()

    // A failed read must not silently close the shop, so the last known state stands.
    if (!error && data) setSettings(data as ShopSettings)
    setReady(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Customers browsing when an admin flips the pause switch should notice within
  // about half a minute, without hammering the database.
  usePolling(() => void load(), 30000)

  const value = useMemo<ShopValue>(
    () => ({ ...settings, ready, refresh: () => void load() }),
    [settings, ready, load],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop(): ShopValue {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>')
  return ctx
}
