import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/format'
import { productImageUrl } from '../lib/supabase'
import { BoxIcon } from './Icons'
import type { Product } from '../lib/types'

export function ProductCard({ product }: { product: Product }) {
  const image = productImageUrl(product.image_path)

  return (
    <Link to={`/p/${product.id}`} className="pcard">
      <div className="pcard__media">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="noimg">
            <BoxIcon size={34} />
          </span>
        )}
      </div>
      <div className="pcard__body">
        <span className="pcard__name">{product.name}</span>
        <span className="pcard__price">{formatPrice(product.price_cents)}</span>
      </div>
    </Link>
  )
}
