/**
 * Web Push from the browser's side: what this device can do, the permission
 * prompt, and the subscription that gets handed to the database. Like geo.ts,
 * every failure is a sentence the person holding the phone can act on.
 *
 * The one platform rule worth knowing: iPhones and iPads only deliver push to
 * a web app that sits on the Home Screen. Safari itself never gets it.
 */
export type PushSupport =
  /** Can ask for permission right now. */
  | 'ready'
  /** iOS in the browser: only the Home Screen app may receive push. */
  | 'needs-install'
  /** Blocked in the browser's site settings; only the user can undo that. */
  | 'denied'
  /** No service worker or push here, or the page is not on https. */
  | 'unsupported'

export class PushError extends Error {}

/** What the database stores per device. */
export interface PushDevice {
  endpoint: string
  p256dh: string
  auth: string
}

export function isIOS(): boolean {
  // iPadOS reports itself as a Mac; the touch points give it away.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'ready'
}

/**
 * Ask, then subscribe. Must run from a tap: browsers only show the permission
 * prompt inside a user gesture, which is also why the prompt comes before any
 * other await -- Safari forgets the gesture quickly.
 */
export async function subscribeToPush(publicKey: string): Promise<PushDevice> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushError('Notifications are blocked for this site. Allow them in your browser settings and try again.')
  }

  const registration = await withTimeout(navigator.serviceWorker.ready, 8000)
  const key = base64UrlToBytes(publicKey)

  let subscription = await registration.pushManager.getSubscription()
  // A subscription made under an older key cannot be reused; start over.
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
  }
  return toDevice(subscription)
}

/** The subscription this browser already holds, if any. Never prompts. */
export async function currentPushDevice(): Promise<PushDevice | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? toDevice(subscription) : null
}

/** Drops the browser-side subscription; returns what it was so the caller can
 *  delete the database row too. */
export async function unsubscribeFromPush(): Promise<PushDevice | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return null
  const device = toDevice(subscription)
  await subscription.unsubscribe()
  return device
}

function toDevice(subscription: PushSubscription): PushDevice {
  const keys = subscription.toJSON().keys ?? {}
  if (!keys.p256dh || !keys.auth) throw new PushError('This browser returned an unusable subscription.')
  return { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth }
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey
  if (!current) return true
  const a = new Uint8Array(current)
  return a.length === key.length && a.every((byte, i) => byte === key[i])
}

/** VAPID public keys travel as base64url; PushManager wants the raw bytes. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new PushError('The app is still loading. Give it a moment and try again.')),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
