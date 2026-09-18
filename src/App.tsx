import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CartProvider } from './state/CartContext'
import { AuthProvider } from './state/AuthContext'
import { ShopProvider } from './state/ShopContext'
import { Shell, Spinner } from './components/Shell'

import Shop from './routes/Shop'
import Product from './routes/Product'
import Checkout from './routes/Checkout'
import OrderStatus from './routes/OrderStatus'

// Five people ever open these screens; customers should not pay for them on a
// mobile connection. Split out so the shop's first load stays small.
const AdminLogin = lazy(() => import('./routes/admin/AdminLogin'))
const AdminLayout = lazy(() => import('./routes/admin/AdminLayout'))
const AdminOrders = lazy(() => import('./routes/admin/AdminOrders'))
const AdminProducts = lazy(() => import('./routes/admin/AdminProducts'))
const AdminSettings = lazy(() => import('./routes/admin/AdminSettings'))

function Loading() {
  return (
    <Shell>
      <div className="empty">
        <Spinner />
      </div>
    </Shell>
  )
}

// Vite's base ("/" or e.g. "/shop/") becomes the router's basename, so every
// route and link below stays written as if the app lived at the root. The
// router wants it without the trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ShopProvider>
          <CartProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Shop />} />
                <Route path="/p/:id" element={<Product />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/o/:token" element={<OrderStatus />} />

                {/* Unlisted staff area. Nothing in the customer UI links to /303. */}
                <Route path="/303">
                  <Route index element={<AdminLogin />} />
                  <Route element={<AdminLayout />}>
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </CartProvider>
        </ShopProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
