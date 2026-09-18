import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../state/CartContext'
import { formatPrice } from '../lib/format'
import { productImageUrl } from '../lib/supabase'
import { BoxIcon, CloseIcon, TrashIcon } from './Icons'

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, totalCents, count, setQuantity, remove } = useCart()
  const navigate = useNavigate()

  // Keep the page behind the sheet from scrolling under the finger.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="sheet__grip" />

        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="h2" style={{ margin: 0 }}>
            Your cart{count > 0 && <span className="muted"> · {count}</span>}
          </h2>
          <button type="button" className="topbar__back" onClick={onClose} aria-label="Close cart">
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="empty">
            <div className="empty__mark">
              <BoxIcon size={40} />
            </div>
            <p style={{ margin: 0 }}>Nothing in here yet.</p>
          </div>
        ) : (
          <>
            <div className="sheet__scroll">
              {lines.map((line) => {
                const image = productImageUrl(line.image_path)
                return (
                  <div className="line" key={line.product_id}>
                    {image ? (
                      <img className="line__thumb" src={image} alt="" loading="lazy" />
                    ) : (
                      <span className="line__thumb" style={{ display: 'grid', placeItems: 'center' }}>
                        <BoxIcon size={20} />
                      </span>
                    )}

                    <div className="line__main">
                      <div className="line__name">{line.name}</div>
                      <div className="tiny muted">{formatPrice(line.price_cents)} each</div>
                    </div>

                    <div className="qty">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product_id, line.quantity - 1)}
                        aria-label={`One less ${line.name}`}
                      >
                        {line.quantity === 1 ? <TrashIcon /> : '−'}
                      </button>
                      <span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product_id, line.quantity + 1)}
                        disabled={line.quantity >= 99}
                        aria-label={`One more ${line.name}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="topbar__back"
                      onClick={() => remove(line.product_id)}
                      aria-label={`Remove ${line.name}`}
                      style={{ marginLeft: 0, width: 34 }}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </div>
                )
              })}
            </div>

            <hr className="divider" />
            <div className="row">
              <span className="muted">Total</span>
              <span className="total">{formatPrice(totalCents)}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  onClose()
                  navigate('/checkout')
                }}
              >
                Review order
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
