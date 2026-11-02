/**
 * Supabase client — the single connection the whole app uses to talk to the
 * database, authentication and file storage.
 *
 * The two values below come from your .env file. Vite only exposes variables
 * that start with VITE_ to the browser, which is exactly what we want:
 * the anon key is MEANT to be public — it is Row Level Security in the
 * database (see supabase/02_rls.sql) that decides what each person may see.
 *
 * The service_role key must NEVER appear anywhere in this folder.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when .env has been filled in. Used to show a friendly setup screen. */
export const isSupabaseConfigured =
  Boolean(url && anonKey) && !url.includes('your-project-ref')

if (!isSupabaseConfigured) {
  console.warn(
    '[LastGods] Supabase is not configured yet.\n' +
      'Copy .env.example to .env and paste your project URL and anon key.',
  )
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true, // stay logged in after closing the tab
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for password-reset / invite links
    },
  },
)

/**
 * Turns a Supabase error into a sentence a human can actually read.
 * Used by every toast in the app.
 */
export function readableError(error) {
  if (!error) return 'Something went wrong.'
  const msg = error.message || String(error)

  if (msg.includes('Invalid login credentials')) return 'Wrong email or password.'
  if (msg.includes('Email not confirmed')) return 'That email has not been confirmed yet.'
  if (msg.includes('violates row-level security'))
    return "You don't have permission to do that."
  if (msg.includes('duplicate key')) return 'That already exists.'
  if (msg.includes('Failed to fetch'))
    return 'Cannot reach the server. Check your internet connection.'
  return msg
}
