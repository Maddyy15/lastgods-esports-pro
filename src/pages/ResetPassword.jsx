/**
 * Where the "set your password" email link lands.
 *
 * Supabase puts a temporary session in the URL, so by the time this page
 * renders the person is already signed in just long enough to choose a
 * password.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Card, Alert } from '@/components/ui/Primitives'
import { Input } from '@/components/ui/Form'

export default function ResetPassword() {
  const { updatePassword, isLoggedIn, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await updatePassword(password)
      toast.success('Password saved. You are signed in.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10">
            <KeyRound size={24} className="text-accent" />
          </div>
          <h1 className="font-display text-3xl font-semibold uppercase text-fg">
            Set your password
          </h1>
        </div>

        <Card>
          {!isLoggedIn && !loading ? (
            <Alert tone="warn" title="This link has expired">
              Password links only work once, and only for a short time. Go back to
              the sign-in page and request a new one.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters."
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={error}
              />
              <Button type="submit" loading={busy} className="w-full justify-center">
                Save password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
