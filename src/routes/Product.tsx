import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, productImageUrl } from '../lib/supabase'
import { formatPrice } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { useCart } from '../state/CartContext'
import { useShop } from '../state/ShopContext'
import { TopBar } from '../components/TopBar'
import { CartSheet } from '../components/CartSheet'
import { ErrorNote, Shell } from '../components/Shell'
import { BoxIcon, CheckIcon } from '../components/Icons'
import type { Product as ProductType } from '../lib/types'

export default function Product() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { add, quantityOf } = useCart()
  const shop = useShop()

  const [product, setProduct] = useState<ProductType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartOpen, setCartOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true

    void (async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (!active) return
      if (err) setError(errorMessage(err, 'Could not load this item.'))
      else if (!data) setError('This item is no longer available.')
      else setProduct(data as ProductType)
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [id])

  // Confirmation flash on the button, so a tap is obviously registered.
  useEffect(() => {
    if (!justAdded) return
    const t = setTimeout(() => setJustAdded(false), 1400)
    return () => clearTimeout(t)
  }, [justAdded])

  const inCart = product ? quantityOf(product.id) : 0
  const image = productImageUrl(product?.image_path)

  return (
    <Shell>
      <TopBar onBack={() => navigate(-1)} onOpenCart={() => setCartOpen(true)} />

      <main className="shell__main">
        {loading ? (
          <>
            <div className="skeleton" style={{ aspectRatio: '1 / 1', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 26, width: '70%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 18, width: '40%' }} />
          </>
        ) : error || !product ? (
          <>
            <ErrorNote>{error ?? 'This item is no longer available.'}</ErrorNote>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
                Back to the shop
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="phero">
              {image ? (
                <img src={image} alt={product.name} />
              ) : (
                <span className="noimg">
                  <BoxIcon size={52} />
                </span>
              )}
            </div>

            <h1 className="h1">{product.name}</h1>
            <p className="price-big">{formatPrice(product.price_cents)}</p>

            {product.description && (
              <p className="prose" style={{ marginTop: 14 }}>
                {product.description}
              </p>
            )}

            <div className="panel" style={{ marginTop: 18 }}>
              <div className="row">
                <span className="muted tiny">Payment</span>
                <span className="tiny">Cash, when you pick it up</span>
              </div>
              <div className="row">
                <span className="muted tiny">Pickup</span>
                <span className="tiny">10 minutes once an admin accepts</span>
              </div>
            </div>
          </>
        )}
      </main>

      {product && !shop.is_paused && (
        <div className="actionbar">
          {inCart > 0 && (
            <p className="tiny muted" style={{ margin: 0, textAlign: 'center' }}>
              {inCart} already in your cart
            </p>
          )}
          <button
            type="button"
            className={justAdded ? 'btn btn--accent' : 'btn btn--primary'}
            onClick={() => {
              add(product)
              setJustAdded(true)
            }}
          >
            {justAdded ? (
              <>
                <CheckIcon /> Added
              </>
            ) : (
              'Add to cart'
            )}
          </button>
        </div>
      )}

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </Shell>
  )
}
