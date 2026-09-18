import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../state/AuthContext'
import { Shell, Spinner } from '../../components/Shell'
import { VaporIcon } from '../../components/Icons'

/**
 * Gate for everything under /303. Row level security is what actually protects
 * the data; this only decides what to render, and confirms the signed-in user
 * really is one of the five admins rather than just any authenticated session.
 */
export default function AdminLayout() {
  const { session, ready, animalName, signOut } = useAuth()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setIsAdmin(null)
      return
    }
    let active = true

    void (async () => {
      const { data } = await supabase
        .from('admins')
        .select('animal_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (active) setIsAdmin(Boolean(data))
    })()

    return () => {
      active = false
    }
  }, [session])

  if (!ready) {
    return (
      <Shell>
        <div className="empty">
          <Spinner />
        </div>
      </Shell>
    )
  }

  if (!session) return <Navigate to="/303" replace />

  if (isAdmin === null) {
    return (
      <Shell>
        <div className="empty">
          <Spinner />
        </div>
      </Shell>
    )
  }

  if (!isAdmin) {
    return (
      <Shell>
        <main className="shell__main">
          <div className="empty">
            <p>This account has no admin access.</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void signOut().then(() => navigate('/303'))}
            >
              Sign out
            </button>
          </div>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="topbar">
        <span className="topbar__mark">
          <VaporIcon size={26} />
        </span>
        <span className="topbar__name" style={{ fontSize: 15 }}>
          Sunice
        </span>
        <span className="topbar__spacer" />
        <span className="chip chip--accepted" style={{ textTransform: 'capitalize' }}>
          {animalName ?? 'admin'}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void signOut().then(() => navigate('/303', { replace: true }))}
        >
          Out
        </button>
      </header>

      <nav className="tabs">
        <NavLink to="/303/orders">Orders</NavLink>
        <NavLink to="/303/products">Items</NavLink>
        <NavLink to="/303/settings">Shop</NavLink>
      </nav>

      <main className="shell__main">
        <Outlet />
      </main>
    </Shell>
  )
}
