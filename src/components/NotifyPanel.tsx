import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { currentPushDevice, pushSupport, subscribeToPush, type PushDevice } from '../lib/push'
import { useShop } from '../state/ShopContext'
import { BellIcon } from './Icons'

interface NotifyPanelProps {
  /** The order's access token: the customer's only proof it is theirs. */
  token: string
  /** Told whenever this device's subscription for the order changes. */
  onChange?: (on: boolean) => void
}

/**
 * "Tell me when it is accepted." Sits under the waiting panel of the order
 * page. On an iPhone in Safari it turns into the two install steps instead,
 * because push only ever reaches the Home Screen app there -- and thanks to the
 * iOS manifest (see vite.config.ts) that app opens on this very order.
 */
export function NotifyPanel({ token, onChange }: NotifyPanelProps) {
  const { push_public_key: publicKey } = useShop()
  const [support] = useState(() => pushSupport())
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A device that already said yes for an earlier order simply moves on to
  // this one -- no second tap needed.
  useEffect(() => {
    if (support !== 'ready' || Notification.permission !== 'granted') return
    let cancelled = false
    void currentPushDevice().then(async (device) => {
      if (!device || cancelled) return
      try {
        await bind(token, device)
        if (!cancelled) {
          setOn(true)
          onChange?.(true)
        }
      } catch {
        // The button stays; a tap will retry with a fresh subscription.
      }
    })
    return () => {
      cancelled = true
    }
  }, [support, token])

  if (!publicKey || support === 'unsupported') return null

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await bind(token, await subscribeToPush(publicKey))
      setOn(true)
      onChange?.(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not turn on notifications.'))
    } finally {
      setBusy(false)
    }
  }

  if (on) {
    return (
      <div className="panel">
        <div className="row" style={{ justifyContent: 'flex-start', color: 'var(--acid)' }}>
          <BellIcon />
          <strong>Notifications on</strong>
        </div>
        <p className="muted tiny" style={{ margin: '6px 0 0' }}>
          You will get a ping the moment an admin takes your order. The phone can go back
          in your pocket.
        </p>
      </div>
    )
  }

  if (support === 'needs-install') {
    return (
      <div className="panel">
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Notifications on iPhone
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Your iPhone only delivers them to the app on your Home Screen. Two steps:
        </p>
        <ol className="steps">
          <li>
            Tap <strong>Share</strong> (the square with the arrow), then{' '}
            <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Open <strong>Sunice</strong> from your Home Screen — this order will be right
            there — and tap <strong>Notify me</strong>.
          </li>
        </ol>
        <p className="muted tiny" style={{ margin: '10px 0 0' }}>
          Until then, keep this screen open.
        </p>
      </div>
    )
  }

  if (support === 'denied') {
    return (
      <div className="notice notice--warn">
        <span>
          Notifications are blocked for this site. Allow them in your browser&apos;s site
          settings if you want a ping when your order is accepted.
        </span>
      </div>
    )
  }

  return (
    <div className="panel">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Notifications
      </p>
      <p style={{ margin: '0 0 12px' }}>
        Get a ping the moment an admin takes your order — even with the phone locked.
      </p>
      <button type="button" className="btn btn--accent" disabled={busy} onClick={() => void enable()}>
        <BellIcon /> {busy ? 'One moment' : 'Notify me'}
      </button>
      {error && (
        <div className="notice notice--warn" style={{ marginTop: 10 }}>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

async function bind(token: string, device: PushDevice): Promise<void> {
  const { error } = await supabase.rpc('subscribe_order_push', {
    p_access_token: token,
    p_endpoint: device.endpoint,
    p_p256dh: device.p256dh,
    p_auth: device.auth,
  })
  if (error) throw error
}
