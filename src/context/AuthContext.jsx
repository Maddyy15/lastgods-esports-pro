/**
 * AuthContext — who is logged in, and what they are allowed to do.
 *
 * It keeps three things in sync:
 *   session  — the Supabase login session (null when logged out)
 *   profile  — our own profiles row, which holds the permission level
 *   can      — a small object of yes/no answers used to show or hide buttons
 *
 * Remember: hiding a button is only politeness. The real rules are the Row
 * Level Security policies in supabase/02_rls.sql.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, readableError } from '@/lib/supabase'
import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  /** Loads (or reloads) the profile row for the logged-in user. */
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[auth] could not load profile:', error.message)
      setProfile(null)
      return null
    }
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let active = true

    // 1. Check whether we are already logged in (e.g. after a page refresh)
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      if (active) setLoading(false)
    })

    // 2. React to logging in, logging out and token refreshes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return
      setSession(newSession)
      await loadProfile(newSession?.user?.id)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  /* ---------------------------------------------------------------- actions */

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(readableError(error))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  /** Sends a "set your password" email. Used for invites and forgotten passwords. */
  const sendResetEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw new Error(readableError(error))
  }, [])

  /** Used on the reset-password screen, and from "Change my password". */
  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(readableError(error))
  }, [])

  /* ------------------------------------------------------------ permissions */

  const value = useMemo(() => {
    const role = profile?.role || null
    const isAdmin = ADMIN_ROLES.includes(role)
    const isStaff = STAFF_ROLES.includes(role)

    return {
      session,
      user: session?.user || null,
      profile,
      role,
      loading,
      isLoggedIn: Boolean(session),
      myPlayerId: profile?.player_id || null,

      /** Quick permission answers used throughout the UI. */
      can: {
        editMatches: isStaff,
        editPlayers: isAdmin,
        editOwnPlayer: Boolean(profile?.player_id),
        editTournaments: isStaff,
        editOpponents: isStaff,
        editSchedule: isStaff,
        editNotes: isStaff,
        markOwnAvailability: Boolean(profile?.player_id),
        manageUsers: isAdmin,
        manageSettings: isAdmin,
        deleteAnything: isStaff,
      },
      isAdmin,
      isStaff,

      signIn,
      signOut,
      sendResetEmail,
      updatePassword,
      refreshProfile: () => loadProfile(session?.user?.id),
    }
  }, [session, profile, loading, signIn, signOut, sendResetEmail, updatePassword, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
