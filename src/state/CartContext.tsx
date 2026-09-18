import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '../lib/hooks'
import type { CartLine, Product } from '../lib/types'

const STORAGE_KEY = 'sunice.cart.v1'
const MAX_QTY = 99

interface CartValue {
  lines: CartLine[]
  count: number
  /** Indicative only -- the database recomputes the real total when ordering. */
  totalCents: number
  add: (product: Product, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
  quantityOf: (productId: string) => number
}

const CartContext = createContext<CartValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = usePersistentState<CartLine[]>(STORAGE_KEY, [])

  const add = useCallback(
    (product: Product, quantity = 1) => {
      const existing = lines.find((l) => l.product_id === product.id)
      if (existing) {
        setLines(
          lines.map((l) =>
            l.product_id === product.id
              ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) }
              : l,
          ),
        )
        return
      }
      setLines([
        ...lines,
        {
          product_id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          image_path: product.image_path,
          quantity: Math.min(MAX_QTY, Math.max(1, quantity)),
        },
      ])
    },
    [lines, setLines],
  )

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setLines(lines.filter((l) => l.product_id !== productId))
        return
      }
      setLines(
        lines.map((l) =>
          l.product_id === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l,
        ),
      )
    },
    [lines, setLines],
  )

  const remove = useCallback(
    (productId: string) => setLines(lines.filter((l) => l.product_id !== productId)),
    [lines, setLines],
  )

  const clear = useCallback(() => setLines([]), [setLines])

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      totalCents: lines.reduce((n, l) => n + l.price_cents * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      quantityOf: (id) => lines.find((l) => l.product_id === id)?.quantity ?? 0,
    }),
    [lines, add, setQuantity, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
