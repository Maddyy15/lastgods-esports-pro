/**
 * Route guards and the full-screen states that go with them.
 *
 * <RequireAuth>  — bounces you to /login when you are not signed in
 * <RequireAdmin> — Settings is Owner/Admin only
 */
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert, Loader2, UserX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { Button, Alert } from '@/components/ui/Primitives'

/** Centred full-page message, used by every state on this page. */
function FullScreen({ icon: Icon, title, children, spin = false }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {Icon && (
        <Icon
          size={34}
          className={spin ? 'animate-spin text-accent' : 'text-accent'}
        />
      )}
      {title && (
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-fg">
          {title}
        </h1>
      )}
      <div className="max-w-md text-sm text-muted">{children}</div>
    </div>
  )
}

export function LoadingScreen({ message = 'Loading team data…' }) {
  return <FullScreen icon={Loader2} spin>{message}</FullScreen>
}

export function RequireAuth({ children }) {
  const { loading, isLoggedIn, profile } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking your session…" />

  if (!isLoggedIn) {
    // Remember where they were heading, so login can send them back
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Signed in, but the profile row is missing — the admin needs to fix it
  if (!profile) {
    return (
      <FullScreen icon={UserX} title="Account not set up">
        <p>
          You are signed in, but this account has no profile yet. Ask an Admin to
          open <strong>Settings → Manage Users</strong> and give you a permission
          level.
        </p>
        <SignOutButton />
      </FullScreen>
    )
  }

  return children
}

export function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Alert tone="error" title="Admins only">
          This page can only be opened by the team Owner or an Admin.
        </Alert>
      </div>
    )
  }

  return children
}

function SignOutButton() {
  const { signOut } = useAuth()
  return (
    <div className="mt-4">
      <Button variant="secondary" onClick={signOut}>
        Sign out
      </Button>
    </div>
  )
}

/** Shown when the whole data load fails (bad keys, SQL not run, offline). */
export function DataErrorScreen() {
  const { error, hardReload } = useData()
  return (
    <FullScreen icon={ShieldAlert} title="Could not load data">
      <p className="mb-3">{error}</p>
      <p className="mb-4 text-xs text-faint">
        The usual causes: the SQL files in <code>/supabase</code> have not been run
        yet, or the keys in <code>.env</code> are wrong.
      </p>
      <Button onClick={() => hardReload()}>Try again</Button>
    </FullScreen>
  )
}
