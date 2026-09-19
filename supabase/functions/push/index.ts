// Sunice Vape Shop :: the push edge function.
//
// Called by the orders trigger (supabase/migrations/0008_push.sql) with
// { event: 'order_created' | 'order_accepted', order_id }. Everything shown to
// a phone is read from the database with the service key; the request body is
// trusted for nothing but the order id and the event name.
//
//   order_created  -> every admin device        "New order GMDP"
//   order_accepted -> that customer's devices   "Order GMDP accepted"
//
// A push_deliveries row is claimed before anything is sent, so a retried or
// replayed call can never notify anyone twice. Devices whose push service
// answers 404/410 are deleted on the spot.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are edge
// function secrets (README, "Push notifications"). The webhook secret comes
// from Vault through push_config(), which only the service key may call.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type PushEvent = 'order_created' | 'order_accepted'

interface Device {
  endpoint: string
  p256dh: string
  auth: string
}

/** What the service worker (src/sw.ts) turns into a notification. `path` is
 *  relative to the app's scope, so this function never needs to know where
 *  the shop is hosted. */
interface Payload {
  title: string
  body: string
  path: string
  tag: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceKey = secretKey()
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / secret key missing')

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'https://mlevo.de/shop/',
  required('VAPID_PUBLIC_KEY'),
  required('VAPID_PRIVATE_KEY'),
)

const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('method not allowed', 405)

  if (!(await authorized(req))) return text('unauthorized', 401)

  let body: { event?: unknown; order_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body is not JSON' }, 400)
  }
  const event = body.event
  const orderId = body.order_id
  if ((event !== 'order_created' && event !== 'order_accepted') || typeof orderId !== 'string') {
    return json({ error: 'expected { event, order_id }' }, 400)
  }

  // Claim the delivery first. ignoreDuplicates makes a repeat come back empty.
  const claim = await db
    .from('push_deliveries')
    .upsert({ order_id: orderId, event }, { onConflict: 'order_id,event', ignoreDuplicates: true })
    .select('order_id')
  if (claim.error) return json({ error: claim.error.message }, 500)
  if (!claim.data || claim.data.length === 0) return json({ event, skipped: 'already delivered' })

  const { data: order, error: orderErr } = await db
    .from('orders')
    .select('id, code, status, total_cents, access_token, accepted_by, pickup_note, pickup_lat, order_items(quantity)')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr) return json({ error: orderErr.message }, 500)
  if (!order) return json({ error: 'no such order' }, 404)

  let devices: Device[] = []
  let payload: Payload
  let ttl: number

  if (event === 'order_created') {
    // Taken already? Then the board has moved on and the ping would only confuse.
    if (order.status !== 'pending') return json({ event, skipped: `order is ${order.status}` })

    const { data, error } = await db.from('admin_push_subscriptions').select('endpoint, p256dh, auth')
    if (error) return json({ error: error.message }, 500)
    devices = data ?? []

    const count = (order.order_items as { quantity: number }[]).reduce((n, i) => n + i.quantity, 0)
    payload = {
      title: `New order ${order.code}`,
      body: `${count} ${count === 1 ? 'item' : 'items'} · ${money.format(order.total_cents / 100)} in cash`,
      path: '303/orders',
      tag: `order-${order.id}`,
    }
    ttl = 30 * 60
  } else {
    if (order.status !== 'accepted') return json({ event, skipped: `order is ${order.status}` })

    const { data, error } = await db
      .from('order_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('order_id', order.id)
    if (error) return json({ error: error.message }, 500)
    devices = data ?? []

    const { data: admin } = await db
      .from('admins')
      .select('animal_name')
      .eq('id', order.accepted_by ?? '')
      .maybeSingle()
    const who = admin?.animal_name ? capitalize(admin.animal_name) : 'An admin'
    const where = order.pickup_note
      ? order.pickup_note
      : order.pickup_lat !== null
        ? 'Tap for the map.'
        : 'Tap to see where to meet.'
    payload = {
      title: `Order ${order.code} accepted`,
      body: `${who} is ready. ${where} You have 10 minutes.`,
      path: `o/${order.access_token}`,
      tag: `order-${order.id}`,
    }
    ttl = 15 * 60
  }

  const results = await Promise.all(devices.map((d) => send(d, payload, ttl)))
  const gone = results.filter((r) => r.gone).map((r) => r.endpoint)
  if (gone.length > 0) {
    await db.from('admin_push_subscriptions').delete().in('endpoint', gone)
    await db.from('order_push_subscriptions').delete().in('endpoint', gone)
  }

  return json({
    event,
    order: order.code,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && !r.gone).map((r) => r.status ?? 'error'),
    removed: gone.length,
  })
})

async function send(device: Device, payload: Payload, ttl: number) {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(payload),
      { TTL: ttl, urgency: 'high' },
    )
    return { endpoint: device.endpoint, ok: true, gone: false }
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    // 404 and 410 are the push service saying the subscription no longer exists.
    return { endpoint: device.endpoint, ok: false, gone: status === 404 || status === 410, status }
  }
}

// ---------------------------------------------------------------- helpers

let webhookSecret: string | null = null

async function authorized(req: Request): Promise<boolean> {
  if (webhookSecret === null) {
    const { data, error } = await db.rpc('push_config')
    const secret = (data as { webhook_secret?: string } | null)?.webhook_secret
    if (error || !secret) throw new Error(`push_config: ${error?.message ?? 'no webhook secret in Vault'}`)
    webhookSecret = secret
  }
  return constantTimeEqual(req.headers.get('x-push-secret') ?? '', webhookSecret)
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Newer projects hand functions a JSON map of secret keys; older ones the
 *  service role JWT. Either acts as the service role. */
function secretKey(): string | undefined {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // fall through to the legacy variable
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set (supabase secrets set ${name}=...)`)
  return value
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function text(message: string, status: number): Response {
  return new Response(message, { status })
}
