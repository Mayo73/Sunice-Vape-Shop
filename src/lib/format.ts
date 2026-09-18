/** Prices are stored as integer cents everywhere; only this module renders them. */
const money = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPrice(cents: number): string {
  return money.format(cents / 100)
}

/** "9:07" -- what the pickup countdown shows. Never goes below zero. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** "just now", "3 min ago" -- used on the admin board where exact times add noise. */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/**
 * Link that opens the point in whatever map app the phone has. The geo: scheme is
 * the native one on Android; iOS and desktop fall back to Google Maps in a tab.
 */
export function mapLinks(lat: number, lng: number) {
  return {
    geo: `geo:${lat},${lng}?q=${lat},${lng}`,
    web: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  }
}
