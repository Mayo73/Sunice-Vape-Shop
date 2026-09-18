import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, CartIcon, VaporIcon } from './Icons'
import { useCart } from '../state/CartContext'

interface TopBarProps {
  onBack?: () => void
  onOpenCart?: () => void
  showCart?: boolean
}

const TAPS_TO_REVEAL = 5
const TAP_WINDOW_MS = 2500

export function TopBar({ onBack, onOpenCart, showCart = true }: TopBarProps) {
  const navigate = useNavigate()
  const { count } = useCart()
  const taps = useRef<number[]>([])

  // The admin entrance is unlisted; five quick taps on the wordmark is the way in
  // for anyone who does not want to type the path.
  const onBrandTap = () => {
    const now = Date.now()
    taps.current = [...taps.current, now].filter((t) => now - t < TAP_WINDOW_MS)
    if (taps.current.length >= TAPS_TO_REVEAL) {
      taps.current = []
      navigate('/303')
    }
  }

  return (
    <header className="topbar">
      {onBack && (
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
      )}

      <button type="button" className="topbar__brand" onClick={onBrandTap} aria-label="Sunice">
        <span className="topbar__mark">
          <VaporIcon size={30} />
        </span>
        <span className="topbar__name">Sunice</span>
      </button>

      <span className="topbar__spacer" />

      {showCart && onOpenCart && (
        <button type="button" className="cartbtn" onClick={onOpenCart}
          aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
          <CartIcon />
          {count > 0 && <span className="cartbtn__count">{count}</span>}
        </button>
      )}
    </header>
  )
}
