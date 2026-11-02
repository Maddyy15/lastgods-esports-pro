/**
 * Login page.
 *
 * There is no "Sign up" here on purpose — this is a private team tool.
 * New members are created by an Admin in the Supabase dashboard (or invited
 * by email), and they set their own password through the reset link.
 */
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogIn, Mail, KeyRound, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Card } from '@/components/ui/Primitives'
import { Input } from '@/components/ui/Form'

export default function Login() {
  const { signIn, sendResetEmail, isLoggedIn, loading } = useAuth()
  const location = useLocation()

  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (isLoggedIn && !loading) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  async function handleLogin(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      toast.success('Welcome back')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendResetEmail(email)
      toast.success('Check your email for the password link')
      setMode('login')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm animate-[fade-up_0.5s_cubic-bezier(0.22,1,0.36,1)]">
        {/* Logo + wordmark */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 shadow-[0_0_40px_-10px_var(--color-accent)]">
            <img src="/logo.svg" alt="" className="h-10 w-10" />
          </div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-fg">
            LastGods
          </h1>
          <p className="font-head text-sm uppercase tracking-[0.3em] text-accent">
            Esports
          </p>
          <p className="mt-2 text-xs text-muted">Team analytics · members only</p>
        </div>

        <Card>
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@team.com"
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={error}
              />

              <Button type="submit" loading={busy} className="w-full justify-center">
                <LogIn size={16} /> Sign in
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                }}
                className="w-full text-center text-xs text-muted transition-colors hover:text-accent"
              >
                Forgot your password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-fg">
                <KeyRound size={16} className="text-accent" />
                Reset your password
              </div>
              <p className="text-xs text-muted">
                Enter your email and we will send you a link to set a new password.
              </p>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@team.com"
                error={error}
              />
              <Button type="submit" loading={busy} className="w-full justify-center">
                <Mail size={16} /> Send reset link
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className="flex w-full items-center justify-center gap-1 text-xs text-muted transition-colors hover:text-accent"
              >
                <ArrowLeft size={12} /> Back to sign in
              </button>
            </form>
          )}
        </Card>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
          No account? This platform is invite-only.
          <br />
          Ask the team Admin to create one for you.
        </p>
      </div>
    </div>
  )
}
