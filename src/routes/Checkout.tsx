import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, productImageUrl } from '../lib/supabase'
import { formatPrice } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { rememberOrder } from '../lib/activeOrder'
import { useCart } from '../state/CartContext'
import { useShop } from '../state/ShopContext'
import { TopBar } from '../components/TopBar'
import { ErrorNote, Shell, Spinner } from '../components/Shell'
import { BoxIcon } from '../components/Icons'
import type { CreatedOrder, Product } from '../lib/types'

export default function Checkout() {
  const navigate = useNavigate()
  const { lines, setQuantity, clear } = useCart()
  const shop = useShop()

  const [live, setLive] = useState<Map<string, Product> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)

  const ids = lines.map((l) => l.product_id)
  const idKey = ids.join(',')

  // The cart is stored on the device and may be hours old, so prices and
  // availability are re-read before anything is shown as a total. The database
  // does the same when the order is placed; this only keeps the screen honest.
  const refresh = useCallback(async () => {
    if (ids.length === 0) {
      setLive(new Map())
      return
    }
    const { data, error: err } = await supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .eq('is_active', true)

    if (err) {
      setError(errorMessage(err, 'Could not check your cart.'))
      return
    }
    setError(null)
    setLive(new Map((data as Product[]).map((p) => [p.id, p])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const priced = lines.map((line) => ({
    line,
    product: live?.get(line.product_id) ?? null,
  }))
  const gone = priced.filter((p) => live !== null && p.product === null)
  const ok = priced.filter((p) => p.product !== null)
  const total = ok.reduce((sum, p) => sum + (p.product as Product).price_cents * p.line.quantity, 0)

  const placeOrder = async () => {
    setPlacing(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('create_order', {
        p_items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      })
      if (err) throw err

      const order = data as CreatedOrder
      rememberOrder(order.access_token, order.code)
      clear()
      navigate(`/o/${order.access_token}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not place your order.'))
      // The shop may have just closed, or an item may have gone -- resync both.
      shop.refresh()
      void refresh()
      setPlacing(false)
    }
  }

  if (lines.length === 0) {
    return (
      <Shell>
        <TopBar onBack={() => navigate('/')} showCart={false} />
        <main className="shell__main">
          <div className="empty">
            <div className="empty__mark">
              <BoxIcon size={44} />
            </div>
            <p style={{ margin: 0 }}>Your cart is empty.</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            Back to the shop
          </button>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <TopBar onBack={() => navigate(-1)} showCart={false} />

      <main className="shell__main">
        <p className="eyebrow">Step 2 of 2</p>
        <h1 className="h1">Your order</h1>
        <p className="muted tiny" style={{ marginTop: 2 }}>
          No name, no phone number. You get a pickup code and that is all we keep.
        </p>

        {shop.is_paused && (
          <div style={{ marginTop: 14 }}>
            <ErrorNote>The shop just closed. You cannot place an order right now.</ErrorNote>
          </div>
        )}

        {gone.length > 0 && (
          <div className="notice notice--warn" style={{ marginTop: 14 }} role="alert">
            <span>
              {gone.length === 1 ? 'One item is' : `${gone.length} items are`} no longer available.
              Remove {gone.length === 1 ? 'it' : 'them'} to continue.
            </span>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14 }}>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="panel" style={{ marginTop: 16 }}>
          {priced.map(({ line, product }) => {
            const image = productImageUrl(line.image_path)
            const missing = live !== null && product === null
            return (
              <div className="line" key={line.product_id} style={missing ? { opacity: 0.55 } : undefined}>
                {image ? (
                  <img className="line__thumb" src={image} alt="" loading="lazy" />
                ) : (
                  <span className="line__thumb" style={{ display: 'grid', placeItems: 'center' }}>
                    <BoxIcon size={20} />
                  </span>
                )}

                <div className="line__main">
                  <div className="line__name">{product?.name ?? line.name}</div>
                  <div className="tiny muted">
                    {missing ? (
                      'No longer available'
                    ) : (
                      <>
                        {line.quantity} × {formatPrice((product ?? line).price_cents)}
                      </>
                    )}
                  </div>
                </div>

                {missing ? (
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => setQuantity(line.product_id, 0)}
                  >
                    Remove
                  </button>
                ) : (
                  <strong>{formatPrice((product ?? line).price_cents * line.quantity)}</strong>
                )}
              </div>
            )
          })}

          <hr className="divider" />
          <div className="row">
            <span className="muted">Total</span>
            <span className="total">{live === null ? '—' : formatPrice(total)}</span>
          </div>
        </div>

        <div className="notice notice--info" style={{ marginTop: 12 }}>
          <span>
            <strong>Cash only, on pickup.</strong> Once an admin accepts, you get their location and
            10 minutes to collect.
          </span>
        </div>
      </main>

      <div className="actionbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={placing || live === null || gone.length > 0 || ok.length === 0 || shop.is_paused}
          onClick={() => void placeOrder()}
        >
          {placing ? (
            <>
              <Spinner /> Placing order
            </>
          ) : (
            'Place order'
          )}
        </button>
      </div>
    </Shell>
  )
}
