import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errorMessage } from '../../lib/errors'
import { useShop } from '../../state/ShopContext'
import { ErrorNote, Spinner } from '../../components/Shell'
import { CheckIcon } from '../../components/Icons'
import { useAdminPush } from './useAdminPush'

export default function AdminSettings() {
  const shop = useShop()
  const push = useAdminPush()
  const [paused, setPaused] = useState(shop.is_paused)
  const [message, setMessage] = useState(shop.paused_message)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Adopt the loaded settings once, without stomping on edits in progress.
  useEffect(() => {
    if (!shop.ready) return
    setPaused(shop.is_paused)
    setMessage(shop.paused_message)
  }, [shop.ready])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(t)
  }, [saved])

  const save = async (nextPaused: boolean, nextMessage: string) => {
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('shop_settings')
        .update({ is_paused: nextPaused, paused_message: nextMessage })
        .eq('id', 1)
      if (err) throw err
      shop.refresh()
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'))
      // Snap back so the switch never claims a state the database does not have.
      setPaused(shop.is_paused)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="h2">Shop</h2>

      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <label className="switch panel">
        <span>
          <strong>{paused ? 'Shop is closed' : 'Shop is open'}</strong>
          <br />
          <span className="tiny muted">
            {paused
              ? 'Customers see the closed screen and cannot order.'
              : 'Customers can browse and order.'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={paused}
          disabled={saving}
          onChange={(e) => {
            const next = e.target.checked
            setPaused(next)
            void save(next, message)
          }}
        />
        <span className="switch__track" />
      </label>

      <div className="panel">
        <label className="field" style={{ marginBottom: 10 }}>
          <span className="field__label">Message shown while closed</span>
          <textarea
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            placeholder="Back at 8pm."
          />
        </label>
        <button
          type="button"
          className={saved ? 'btn btn--accent' : 'btn btn--ghost'}
          disabled={saving}
          onClick={() => void save(paused, message)}
        >
          {saving ? (
            <>
              <Spinner /> Saving
            </>
          ) : saved ? (
            <>
              <CheckIcon /> Saved
            </>
          ) : (
            'Save message'
          )}
        </button>
      </div>

      <div className="notice notice--info">
        <span>
          Closing the shop is enforced by the database, not just this screen — an order cannot be
          placed while it is closed, even from a page that was already open.
        </span>
      </div>

      {push.support !== null && (
        <>
          <h2 className="h2" style={{ marginTop: 28 }}>
            Notifications
          </h2>

          {push.error && (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{push.error}</ErrorNote>
            </div>
          )}

          {push.support === 'ready' || push.enabled ? (
            <label className="switch panel">
              <span>
                <strong>{push.enabled ? 'New orders ping this device' : 'This device stays silent'}</strong>
                <br />
                <span className="tiny muted">
                  {push.enabled
                    ? 'Turning this off only affects this device; your other devices keep theirs.'
                    : 'Get a push the moment an order comes in, even with the phone locked.'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={push.enabled}
                disabled={push.busy}
                onChange={(e) => void (e.target.checked ? push.enable() : push.disable())}
              />
              <span className="switch__track" />
            </label>
          ) : (
            <div className="panel">
              <p style={{ margin: 0 }}>
                {push.support === 'needs-install' &&
                  'On iPhone, push only works from the Home Screen app: tap Share → Add to Home Screen, then sign in there and come back here.'}
                {push.support === 'denied' &&
                  'Notifications are blocked for this site in your browser settings. Allow them there, then reload.'}
                {push.support === 'unsupported' &&
                  'This browser cannot receive push notifications. Any recent Chrome, Firefox or Samsung browser can; on iPhone, use the Home Screen app.'}
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}
