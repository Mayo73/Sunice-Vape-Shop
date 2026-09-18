/**
 * With no accounts, the customer's only claim on their order is the access token
 * handed back by create_order. It lives here, in this browser, and nowhere else.
 */
const KEY = 'sunice.order.v1'

export interface ActiveOrder {
  token: string
  code: string
  at: number
}

export function rememberOrder(token: string, code: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, code, at: Date.now() } satisfies ActiveOrder))
  } catch {
    // Storage blocked: the customer still lands on the status page, they just
    // will not be able to navigate back to it later.
  }
}

export function readActiveOrder(): ActiveOrder | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveOrder
    if (!parsed?.token || !parsed?.code) return null
    // A pickup window is ten minutes; a day-old pointer is just clutter.
    if (Date.now() - parsed.at > 24 * 60 * 60 * 1000) {
      forgetOrder()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function forgetOrder(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clean up.
  }
}
