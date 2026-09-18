import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { readActiveOrder } from '../lib/activeOrder'
import { useShop } from '../state/ShopContext'
import { TopBar } from '../components/TopBar'
import { CartSheet } from '../components/CartSheet'
import { ProductCard } from '../components/ProductCard'
import { ErrorNote, Shell } from '../components/Shell'
import { BoxIcon, VaporIcon } from '../components/Icons'
import type { Product } from '../lib/types'

export default function Shop() {
  const shop = useShop()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const active = readActiveOrder()

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (err) {
      setError(errorMessage(err, 'Could not load the shop.'))
      return
    }
    setError(null)
    setProducts((data ?? []) as Product[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Nothing is shown behind a closed shop -- no list, no prices, no ordering.
  if (shop.ready && shop.is_paused) {
    return (
      <Shell>
        <TopBar showCart={false} />
        <main className="shell__main">
          <div className="closed">
            <div className="closed__mark">
              <VaporIcon size={84} />
            </div>
            <h1 className="closed__title">Shop closed</h1>
            <p className="muted" style={{ maxWidth: 300, margin: 0 }}>
              {shop.paused_message || 'We are closed right now. Check back soon.'}
            </p>
          </div>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <TopBar onOpenCart={() => setCartOpen(true)} />

      <main className="shell__main">
        <p className="eyebrow">Pickup only · Cash only</p>
        <h1 className="h1">Tonight&rsquo;s selection</h1>

        {active && (
          <Link to={`/o/${active.token}`} className="notice notice--info" style={{ marginTop: 14, textDecoration: 'none' }}>
            <span>
              You have an order in progress — <strong>{active.code}</strong>. Tap to see it.
            </span>
          </Link>
        )}

        {error && (
          <div style={{ marginTop: 14 }}>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {products === null ? (
          <div className="grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.42' }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty">
            <div className="empty__mark">
              <BoxIcon size={44} />
            </div>
            <p style={{ margin: 0 }}>No items right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </Shell>
  )
}
