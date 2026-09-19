import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import {
  currentPushDevice,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  type PushDevice,
  type PushSupport,
} from '../../lib/push'
import { useAuth } from '../../state/AuthContext'
import { useShop } from '../../state/ShopContext'

export interface AdminPush {
  /** Null while push is not set up on the project at all: show nothing then. */
  support: PushSupport | null
  enabled: boolean
  busy: boolean
  error: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
}

/** New-order notifications for the signed-in admin on this device. */
export function useAdminPush(): AdminPush {
  const { session } = useAuth()
  const { push_public_key: publicKey } = useShop()
  const [support] = useState(() => pushSupport())
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (device: PushDevice) => {
    const { error: err } = await supabase.rpc('register_admin_push', {
      p_endpoint: device.endpoint,
      p_p256dh: device.p256dh,
      p_auth: device.auth,
    })
    if (err) throw err
  }, [])

  // A device that was enabled earlier is re-registered on every visit. That
  // keeps the row fresh and moves the device to whoever is signed in now, for
  // admins who share a phone.
  useEffect(() => {
    if (!publicKey || support !== 'ready' || !session) return
    let cancelled = false
    void currentPushDevice().then(async (device) => {
      if (!device || cancelled) return
      try {
        await register(device)
        if (!cancelled) setEnabled(true)
      } catch {
        // Leave the switch off; turning it on registers a fresh subscription.
      }
    })
    return () => {
      cancelled = true
    }
  }, [publicKey, support, session, register])

  const enable = useCallback(async () => {
    if (!publicKey) return
    setBusy(true)
    setError(null)
    try {
      await register(await subscribeToPush(publicKey))
      setEnabled(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not turn on notifications.'))
    } finally {
      setBusy(false)
    }
  }, [publicKey, register])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const device = await unsubscribeFromPush()
      if (device) {
        await supabase.from('admin_push_subscriptions').delete().eq('endpoint', device.endpoint)
      }
      setEnabled(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not turn off notifications.'))
    } finally {
      setBusy(false)
    }
  }, [])

  return { support: publicKey ? support : null, enabled, busy, error, enable, disable }
}
