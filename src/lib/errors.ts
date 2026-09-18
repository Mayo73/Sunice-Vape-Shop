/**
 * The database raises short, stable codes (SHOP_PAUSED, ORDER_NOT_PENDING, ...).
 * Turning them into sentences happens here so the screens stay free of message
 * strings and every surface says the same thing.
 */
const MESSAGES: Record<string, string> = {
  SHOP_PAUSED: 'The shop just closed. Your order was not placed.',
  EMPTY_CART: 'Your cart is empty.',
  CART_TOO_LARGE: 'That is too many different items for one order.',
  PRODUCT_UNAVAILABLE: 'Something in your cart is no longer available. Please check it again.',
  NOT_ADMIN: 'You are not signed in as an admin.',
  ORDER_NOT_PENDING: 'Another admin already took this order.',
  ORDER_NOT_ACCEPTED: 'This order is not waiting for pickup.',
  ORDER_NOT_OPEN: 'This order is already closed.',
  PICKUP_REQUIRED: 'Add a location or a meeting point before accepting.',
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''

  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code] as string
  }

  // Supabase surfaces a failed password grant as this; say it plainly.
  if (raw.includes('Invalid login credentials')) return 'Wrong animal or password.'
  if (raw.includes('Email not confirmed')) return 'This account is not confirmed yet.'
  if (/fetch|network|Failed to fetch/i.test(raw)) return 'No connection. Check your signal and try again.'

  return raw && raw.length < 140 ? raw : fallback
}
