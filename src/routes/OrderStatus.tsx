import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatPrice, formatCoords, mapLinks } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { forgetOrder, readActiveOrder, rememberOrder } from '../lib/activeOrder'
import { usePolling } from '../lib/hooks'
import { TopBar } from '../components/TopBar'
import { Countdown } from '../components/Countdown'
import { NotifyPanel } from '../components/NotifyPanel'
import { ErrorNote, Shell } from '../components/Shell'
import { CheckIcon, PinIcon, VaporIcon } from '../components/Icons'
import type { CustomerOrder } from '../lib/types'

const POLL_MS = 3000

export default function OrderStatus() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [offsetMs, setOffsetMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifying, setNotifying] = useState(false)
  const missing = useRef(false)

  const load = useCallback(async () => {
    if (!token) return
    const { data, error: err } = await supabase.rpc('get_order', { p_access_token: token })

    if (err) {
      setError(errorMessage(err, 'Could not load your order.'))
      setLoading(false)
      return
    }
    if (!data) {
      missing.current = true
      setError('We could not find this order.')
      setLoading(false)
      return
    }

    const next = data as CustomerOrder
    // Anchor the countdown to the database clock: a phone whose time is off by
    // minutes would otherwise show a pickup window that is simply wrong.
    setOffsetMs(new Date(next.server_now).getTime() - Date.now())
    setOrder(next)
    setError(null)
    setLoading(false)

    // Opened from the secret link in a browser that has never seen this order
    // -- the Home Screen app on an iPhone, say -- adopt it, so the shop page
    // shows the "order in progress" banner here too.
    if ((next.status === 'pending' || next.status === 'accepted') && readActiveOrder()?.token !== token) {
      rememberOrder(token, next.code)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const settled =
    order?.status === 'completed' || order?.status === 'cancelled' || missing.current
  usePolling(() => void load(), POLL_MS, !settled)

  if (loading) {
    return (
      <Shell>
        <TopBar showCart={false} />
        <main className="shell__main">
          <div className="skeleton" style={{ height: 120, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </main>
      </Shell>
    )
  }

  if (error || !order) {
    return (
      <Shell>
        <TopBar onBack={() => navigate('/')} showCart={false} />
        <main className="shell__main">
          <ErrorNote>{error ?? 'We could not find this order.'}</ErrorNote>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              Back to the shop
            </button>
          </div>
        </main>
      </Shell>
    )
  }

  const expired = order.status === 'accepted' && order.is_expired
  const hasCoords = order.pickup_lat !== null && order.pickup_lng !== null

  const chip = (() => {
    if (order.status === 'pending') return { cls: 'chip--pending', label: 'Waiting for an admin' }
    if (order.status === 'completed') return { cls: 'chip--completed', label: 'Picked up' }
    if (order.status === 'cancelled') return { cls: 'chip--cancelled', label: 'Cancelled' }
    if (expired) return { cls: 'chip--expired', label: 'Window expired' }
    return { cls: 'chip--accepted', label: 'Ready for pickup' }
  })()

  return (
    <Shell>
      <TopBar onBack={() => navigate('/')} showCart={false} />

      <main className="shell__main">
        <div className="codewrap">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Your pickup code
          </p>
          <div className="code">{order.code}</div>
          <div style={{ marginTop: 12 }}>
            <span className={`chip ${chip.cls}`}>
              {order.status === 'pending' && <span className="dot" />}
              {chip.label}
            </span>
          </div>
        </div>

        {order.status === 'pending' && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div style={{ opacity: 0.8, marginBottom: 8 }}>
              <VaporIcon size={54} />
            </div>
            <p style={{ margin: 0 }}>An admin is looking at your order.</p>
            <p className="muted tiny" style={{ margin: '6px 0 0' }}>
              {notifying
                ? 'You will get a location and a 10 minute window as soon as someone takes it.'
                : 'Keep this screen open. You will get a location and a 10 minute window as soon as someone takes it.'}
            </p>
          </div>
        )}

        {order.status === 'pending' && token && <NotifyPanel token={token} onChange={setNotifying} />}

        {order.status === 'accepted' && !expired && (
          <>
            <div className="panel">
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                Time to pick up
              </p>
              <Countdown
                expiresAt={order.pickup_expires_at as string}
                offsetMs={offsetMs}
                keepAwake
              />
            </div>

            <div className="panel">
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="muted tiny">Accepted by</span>
                <strong style={{ textTransform: 'capitalize' }}>{order.accepted_by_name}</strong>
              </div>

              <hr className="divider" />

              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Where to go
              </p>

              {order.pickup_note && <p style={{ margin: '0 0 10px' }}>{order.pickup_note}</p>}

              {hasCoords && (
                <>
                  <p className="muted tiny" style={{ margin: '0 0 10px' }}>
                    <PinIcon size={14} />{' '}
                    {formatCoords(order.pickup_lat as number, order.pickup_lng as number)}
                  </p>
                  <div className="btnrow">
                    <a
                      className="btn btn--accent"
                      href={mapLinks(order.pickup_lat as number, order.pickup_lng as number).geo}
                    >
                      Open in maps
                    </a>
                    <a
                      className="btn btn--ghost"
                      href={mapLinks(order.pickup_lat as number, order.pickup_lng as number).web}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Open online
                    </a>
                  </div>
                </>
              )}

              {!hasCoords && !order.pickup_note && (
                <p className="muted" style={{ margin: 0 }}>
                  The admin will tell you where to meet.
                </p>
              )}
            </div>
          </>
        )}

        {expired && (
          <div className="notice notice--warn" style={{ marginBottom: 12 }}>
            <span>
              The 10 minute pickup window has passed. Your code is still shown above — talk to the
              admin if you are still on your way.
            </span>
          </div>
        )}

        {order.status === 'completed' && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--acid)', marginBottom: 6 }}>
              <CheckIcon size={30} />
            </div>
            <p style={{ margin: 0 }}>Picked up. Enjoy.</p>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <p style={{ margin: 0 }}>This order was cancelled.</p>
            <p className="muted tiny" style={{ margin: '6px 0 0' }}>
              Nothing was charged — payment only ever happens in cash at pickup.
            </p>
          </div>
        )}

        <div className="panel">
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            Order
          </p>
          {order.items.map((item, i) => (
            <div className="row" key={`${item.product_name}-${i}`}>
              <span className="tiny">
                {item.quantity} × {item.product_name}
              </span>
              <span className="tiny muted">
                {formatPrice(item.unit_price_cents * item.quantity)}
              </span>
            </div>
          ))}
          <hr className="divider" />
          <div className="row">
            <span className="muted">Total, in cash</span>
            <span className="total">{formatPrice(order.total_cents)}</span>
          </div>
        </div>
      </main>

      {(order.status === 'completed' || order.status === 'cancelled') && (
        <div className="actionbar">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              forgetOrder()
              navigate('/')
            }}
          >
            Back to the shop
          </button>
        </div>
      )}
    </Shell>
  )
}
