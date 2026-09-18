import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentPosition, type Coords } from '../../lib/geo'
import { formatCoords } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { CloseIcon, PinIcon } from '../../components/Icons'
import { ErrorNote, Spinner } from '../../components/Shell'
import type { AdminOrder } from '../../lib/types'

interface AcceptSheetProps {
  order: AdminOrder
  onClose: () => void
  onAccepted: () => void
}

/**
 * Handing over the pickup spot. Two ways in, because the automatic one can fail
 * for reasons the admin cannot fix on the spot (no https, permission denied,
 * indoors with no fix) -- typing a meeting point always works.
 */
export function AcceptSheet({ order, onClose, onAccepted }: AcceptSheetProps) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [note, setNote] = useState('')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const locate = async () => {
    setLocating(true)
    setGeoError(null)
    try {
      setCoords(await getCurrentPosition())
    } catch (err) {
      setGeoError(errorMessage(err, 'Could not get your position.'))
    } finally {
      setLocating(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('accept_order', {
        p_order_id: order.id,
        p_lat: coords?.lat ?? null,
        p_lng: coords?.lng ?? null,
        p_note: note.trim() || null,
      })
      if (err) throw err
      onAccepted()
    } catch (err) {
      setError(errorMessage(err, 'Could not accept this order.'))
      setBusy(false)
    }
  }

  const ready = coords !== null || note.trim().length > 0

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Accept order ${order.code}`}>
        <div className="sheet__grip" />

        <div className="row" style={{ marginBottom: 10 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 2 }}>
              Accept order
            </p>
            <span className="ordercode">{order.code}</span>
          </div>
          <button type="button" className="topbar__back" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="sheet__scroll">
          {error && (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <button
            type="button"
            className={coords ? 'btn btn--accent' : 'btn btn--ghost'}
            onClick={() => void locate()}
            disabled={locating}
          >
            {locating ? (
              <>
                <Spinner /> Getting your position
              </>
            ) : coords ? (
              <>
                <PinIcon /> Location attached
              </>
            ) : (
              <>
                <PinIcon /> Use my location
              </>
            )}
          </button>

          {coords && (
            <p className="tiny muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>
              {formatCoords(coords.lat, coords.lng)} · ±{Math.round(coords.accuracy)} m
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginLeft: 10 }}
                onClick={() => setCoords(null)}
              >
                Clear
              </button>
            </p>
          )}

          {geoError && (
            <div className="notice notice--warn" style={{ marginTop: 10 }}>
              <span>{geoError}</span>
            </div>
          )}

          <label className="field" style={{ marginTop: 16 }}>
            <span className="field__label">Meeting point {coords ? '(optional)' : '(or type it)'}</span>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Back entrance, next to the blue door"
            />
          </label>

          <div className="notice notice--info">
            <span>Accepting starts a 10 minute pickup countdown on the customer&rsquo;s screen.</span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!ready || busy}
            onClick={() => void confirm()}
          >
            {busy ? (
              <>
                <Spinner /> Accepting
              </>
            ) : (
              'Accept and start countdown'
            )}
          </button>
          {!ready && (
            <p className="tiny muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>
              Share your location or type a meeting point first.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
