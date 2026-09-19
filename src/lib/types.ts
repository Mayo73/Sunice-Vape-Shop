export type OrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'

export interface Product {
  id: string
  name: string
  description: string
  price_cents: number
  image_path: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface ShopSettings {
  is_paused: boolean
  paused_message: string
  /** VAPID public key. Null means push is not set up and no controls are shown. */
  push_public_key: string | null
}

export interface CartLine {
  product_id: string
  name: string
  price_cents: number
  image_path: string | null
  quantity: number
}

export interface OrderItem {
  product_name: string
  unit_price_cents: number
  quantity: number
}

/** Shape returned by the `get_order` rpc -- the customer's view of their order. */
export interface CustomerOrder {
  id: string
  code: string
  status: OrderStatus
  total_cents: number
  created_at: string
  accepted_at: string | null
  pickup_expires_at: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_note: string | null
  accepted_by_name: string | null
  /** Database clock at read time; the countdown is anchored to this, not to the phone. */
  server_now: string
  is_expired: boolean
  items: OrderItem[]
}

/** Row shape admins read straight from the `orders` table. */
export interface AdminOrder {
  id: string
  code: string
  status: OrderStatus
  total_cents: number
  accepted_by: string | null
  accepted_at: string | null
  pickup_expires_at: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_note: string | null
  created_at: string
  order_items: OrderItem[]
}

export interface CreatedOrder {
  id: string
  code: string
  access_token: string
}
