/// <reference lib="webworker" />
/**
 * The service worker. Two jobs: keep the app shell cached so an installed
 * phone opens instantly and survives a bad signal, and turn push messages
 * from supabase/functions/push into notifications.
 *
 * Live data never goes through here. Supabase calls are plain network
 * requests, and the navigation fallback refuses their paths outright, so an
 * order status or a countdown can never be served from cache.
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]
}

// A deploy must reach phones that already have the app installed: the new
// worker takes over immediately instead of waiting for every tab to close.
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Client-side routing: unknown paths are app routes, not missing files.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//, /^\/realtime\//],
  }),
)

/** Sent by the edge function. `path` is relative to this worker's scope. */
interface PushPayload {
  title?: string
  body?: string
  path?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = (event.data?.json() as PushPayload) ?? {}
  } catch {
    // Not JSON -- still show something, or the browser shows a generic
    // "site updated in the background" and iOS starts counting silent pushes.
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Sunice', {
      body: data.body ?? '',
      icon: new URL('icon-192.png', scope).href,
      // The same tag replaces an earlier notification about the same order.
      tag: data.tag,
      data: { path: data.path ?? '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = String((event.notification.data as { path?: string } | undefined)?.path ?? '')
  const target = new URL(path, self.registration.scope).href

  event.waitUntil(
    (async () => {
      // Reuse an open tab of the shop when there is one; a phone with the app
      // installed otherwise ends up with a second copy.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const mine = windows.find((c) => c.url.startsWith(self.registration.scope))
      if (mine) {
        await mine.focus()
        if ('navigate' in mine) await mine.navigate(target)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
