import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatAgo, formatClock, formatCoords, formatPrice, mapLinks } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { usePolling } from '../../lib/hooks'
import { Countdown } from '../../components/Countdown'
import { ErrorNote, Spinner } from '../../components/Shell'
import { BoxIcon, PinIcon } from '../../components/Icons'
import { AcceptSheet } from './AcceptSheet'
import type { AdminOrder } from '../../lib/types'

/** Realtime is the fast path; this poll is the safety net if a socket drops. */
const SAFETY_POLL_MS = 10000

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<AdminOrder | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, order_items(product_name, unit_price_cents, quantity)')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: true })

    if (err) {
      setError(errorMessage(err, 'Could not load orders.'))
      return
    }
    setError(null)
    setOrders((data ?? []) as AdminOrder[])
    setNow(Date.now())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  usePolling(() => void load(), SAFETY_POLL_MS)

  // New orders should land on the board without waiting for the next poll.
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  const act = async (id: string, fn: 'complete_order' | 'cancel_order') => {
    setBusyId(id)
    setError(null)
    try {
      const { error: err } = await supabase.rpc(fn, { p_order_id: id })
      if (err) throw err
      await load()
    } catch (err) {
      setError(errorMessage(err))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (orders === null) {
    return (
      <div className="empty">
        <Spinner />
      </div>
    )
  }

  const pending = orders.filter((o) => o.status === 'pending')
  const accepted = orders.filter((o) => o.status === 'accepted')

  return (
    <>
      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {orders.length === 0 && (
        <div className="empty">
          <div className="empty__mark">
            <BoxIcon size={44} />
          </div>
          <p style={{ margin: 0 }}>No open orders.</p>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            New ones appear here by themselves.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 className="h2">
            Waiting <span className="muted">· {pending.length}</span>
          </h2>
          <div className="stack" style={{ marginBottom: 20 }}>
            {pending.map((order) => (
              <div className="panel ordercard ordercard--pending" key={order.id}>
                <div className="row">
                  <span className="ordercode">{order.code}</span>
                  <span className="tiny muted">{formatAgo(order.created_at, now)}</span>
                </div>

                <hr className="divider" />
                <OrderLines order={order} />

                <div className="btnrow" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    style={{ flex: '0 0 auto' }}
                    disabled={busyId === order.id}
                    onClick={() => void act(order.id, 'cancel_order')}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    style={{ flex: 1 }}
                    onClick={() => setAccepting(order)}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {accepted.length > 0 && (
        <>
          <h2 className="h2">
            Out for pickup <span className="muted">· {accepted.length}</span>
          </h2>
          <div className="stack">
            {accepted.map((order) => {
              const expired =
                order.pickup_expires_at !== null &&
                new Date(order.pickup_expires_at).getTime() <= now
              const hasCoords = order.pickup_lat !== null && order.pickup_lng !== null

              return (
                <div
                  className={`panel ordercard ${expired ? 'ordercard--expired' : 'ordercard--accepted'}`}
                  key={order.id}
                >
                  <div className="row">
                    <span className="ordercode">{order.code}</span>
                    {expired ? (
                      <span className="chip chip--expired">Expired</span>
                    ) : (
                      order.pickup_expires_at && (
                        <span className="tiny muted">
                          until {formatClock(order.pickup_expires_at)}
                        </span>
                      )
                    )}
                  </div>

                  {order.pickup_expires_at && !expired && (
                    <div style={{ marginTop: 10 }}>
                      <Countdown expiresAt={order.pickup_expires_at} />
                    </div>
                  )}

                  <hr className="divider" />
                  <OrderLines order={order} />

                  {(hasCoords || order.pickup_note) && (
                    <>
                      <hr className="divider" />
                      {order.pickup_note && <p className="tiny" style={{ margin: '0 0 6px' }}>{order.pickup_note}</p>}
                      {hasCoords && (
                        <a
                          className="tiny muted"
                          href={mapLinks(order.pickup_lat as number, order.pickup_lng as number).web}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <PinIcon size={13} />{' '}
                          {formatCoords(order.pickup_lat as number, order.pickup_lng as number)}
                        </a>
                      )}
                    </>
                  )}

                  <div className="btnrow" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      style={{ flex: '0 0 auto' }}
                      disabled={busyId === order.id}
                      onClick={() => void act(order.id, 'cancel_order')}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--accent btn--sm"
                      style={{ flex: 1 }}
                      disabled={busyId === order.id}
                      onClick={() => void act(order.id, 'complete_order')}
                    >
                      Picked up
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {accepting && (
        <AcceptSheet
          order={accepting}
          onClose={() => setAccepting(null)}
          onAccepted={() => {
            setAccepting(null)
            void load()
          }}
        />
      )}
    </>
  )
}

function OrderLines({ order }: { order: AdminOrder }) {
  return (
    <>
      {order.order_items.map((item, i) => (
        <div className="row" key={`${item.product_name}-${i}`}>
          <span className="tiny">
            {item.quantity} × {item.product_name}
          </span>
          <span className="tiny muted">{formatPrice(item.unit_price_cents * item.quantity)}</span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <span className="muted tiny">Collect in cash</span>
        <span className="total" style={{ fontSize: 19 }}>
          {formatPrice(order.total_cents)}
        </span>
      </div>
    </>
  )
}
