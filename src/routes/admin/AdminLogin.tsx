import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_EMAIL_DOMAIN, useAuth } from '../../state/AuthContext'
import { errorMessage } from '../../lib/errors'
import { ErrorNote, Shell, Spinner } from '../../components/Shell'
import { VaporIcon } from '../../components/Icons'

/**
 * The unlisted way in. Nothing links here: an admin either types /303 or taps
 * the wordmark five times. Admins type their animal name only; the address is
 * assembled for them.
 */
export default function AdminLogin() {
  const { session, ready, signIn } = useAuth()
  const navigate = useNavigate()

  const [animal, setAnimal] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && session) navigate('/303/orders', { replace: true })
  }, [ready, session, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(animal, password)
      navigate('/303/orders', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <main className="shell__main" style={{ display: 'grid', placeItems: 'center', minHeight: '86dvh' }}>
        <form onSubmit={(e) => void onSubmit(e)} style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <VaporIcon size={64} />
            <h1 className="h1" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 22 }}>
              Staff
            </h1>
          </div>

          {error && (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <label className="field">
            <span className="field__label">Animal</span>
            <span className="input-affix">
              <input
                className="input"
                value={animal}
                onChange={(e) => setAnimal(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
              />
              <span className="input-affix__suffix">@{ADMIN_EMAIL_DOMAIN}</span>
            </span>
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="btn btn--primary" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? (
              <>
                <Spinner /> Signing in
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </main>
    </Shell>
  )
}
