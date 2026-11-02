/**
 * DataContext — one shared copy of the team's data for the whole app.
 *
 * Why load everything at once? A team plays hundreds, maybe a few thousand
 * matches. That is tiny for a browser, and it means every page (dashboard,
 * map breakdown, leaderboard, comparison) can calculate instantly from the
 * same numbers without firing a new query each time a filter changes.
 *
 * It also subscribes to Supabase Realtime, so when the coach saves a match on
 * their laptop, everyone else's screen updates without a refresh.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react'
import toast from 'react-hot-toast'
import { supabase, readableError } from '@/lib/supabase'
import { fetchAll } from '@/lib/api'
import { indexStats } from '@/lib/stats'
import { DEFAULT_SETTINGS } from '@/lib/constants'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const EMPTY = {
  settings: null,
  players: [],
  maps: [],
  dropSpots: [],
  matches: [],
  matchStats: [],
  tournaments: [],
  standings: [],
  opponents: [],
  opponentSpots: [],
  events: [],
  attendance: [],
  notes: [],
  announcements: [],
  activity: [],
  profiles: [],
}

/** Writes the accent colour into the page so every Tailwind class follows it. */
function applyAccent(hex) {
  if (!hex) return
  const root = document.documentElement
  root.style.setProperty('--color-accent', hex)
  // The soft version is the same colour at ~13% opacity, used for glows
  root.style.setProperty('--color-accent-soft', `${hex}22`)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#07080a')
}

export function DataProvider({ children }) {
  const { isLoggedIn } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reloadTimer = useRef(null)

  /* ------------------------------------------------------------------ load */
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!isLoggedIn) {
        setData(EMPTY)
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      try {
        const fresh = await fetchAll()
        setData(fresh)
        setError(null)
        applyAccent(fresh.settings?.accent_color || DEFAULT_SETTINGS.accent_color)
      } catch (err) {
        console.error('[data] load failed:', err)
        setError(readableError(err))
      } finally {
        setLoading(false)
      }
    },
    [isLoggedIn],
  )

  useEffect(() => {
    load()
  }, [load])

  /**
   * Reloads everything, but at most once every 400ms. Realtime can fire a
   * burst of events when a match with five players is saved — this collapses
   * them into a single refresh.
   */
  const reload = useCallback(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => load({ silent: true }), 400)
  }, [load])

  /* -------------------------------------------------------------- realtime */
  useEffect(() => {
    if (!isLoggedIn) return

    const channel = supabase
      .channel('lastgods-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        reload()
        // A new announcement is worth interrupting someone for
        if (payload.eventType === 'INSERT' && payload.table === 'announcements') {
          toast(`New announcement: ${payload.new?.title ?? ''}`, { icon: '📣' })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(reloadTimer.current)
    }
  }, [isLoggedIn, reload])

  /* ------------------------------------------------- derived lookups + index */
  const value = useMemo(() => {
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }

    const mapById = new Map(data.maps.map((m) => [m.id, m]))
    const playerById = new Map(data.players.map((p) => [p.id, p]))
    const spotById = new Map(data.dropSpots.map((s) => [s.id, s]))
    const tournamentById = new Map(data.tournaments.map((t) => [t.id, t]))

    return {
      ...data,
      settings,
      loading,
      error,
      reload: () => load({ silent: true }),
      hardReload: load,

      /** Pre-grouped stat rows — see src/lib/stats.js */
      statsIndex: indexStats(data.matchStats),

      /* Lookup helpers, used constantly by tables and cards */
      mapById,
      playerById,
      spotById,
      tournamentById,
      mapName: (id) => mapById.get(id)?.name || '—',
      playerName: (id) => playerById.get(id)?.ign || '—',
      spotName: (id) => spotById.get(id)?.name || '—',
      tournamentName: (id) => tournamentById.get(id)?.name || null,
      spotsForMap: (mapId) => data.dropSpots.filter((s) => s.map_id === mapId),

      /** Only players who should appear in a new match by default. */
      activePlayers: data.players.filter((p) =>
        ['active', 'substitute'].includes(p.status),
      ),

      applyAccent,
    }
  }, [data, loading, error, load])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
