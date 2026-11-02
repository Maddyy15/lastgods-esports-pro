/**
 * All database reads and writes live here.
 * Pages never call supabase directly — they call these functions, which keeps
 * the queries in one place and makes them easy to change later.
 */
import { supabase } from './supabase'

/* ---------------------------------------------------------------------------
 * LOADING
 * ------------------------------------------------------------------------- */

/** Every table the app needs, fetched in parallel in one go. */
export async function fetchAll() {
  const [
    settings,
    players,
    maps,
    dropSpots,
    matches,
    matchStats,
    tournaments,
    standings,
    opponents,
    opponentSpots,
    events,
    attendance,
    notes,
    announcements,
    activity,
    profiles,
  ] = await Promise.all([
    supabase.from('team_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('players').select('*').order('sort_order').order('ign'),
    supabase.from('maps').select('*').order('sort_order'),
    supabase.from('drop_spots').select('*').order('name'),
    supabase.from('matches').select('*').order('played_at', { ascending: false }),
    supabase.from('match_player_stats').select('*'),
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    supabase.from('tournament_standings').select('*'),
    supabase.from('opponents').select('*').order('name'),
    supabase.from('opponent_spots').select('*'),
    supabase.from('schedule_events').select('*').order('starts_at'),
    supabase.from('attendance').select('*'),
    supabase.from('strategy_notes').select('*').order('created_at', { ascending: false }),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('profiles').select('*').order('created_at'),
  ])

  // Surface the first real error so the UI can show it
  const firstError = [
    settings, players, maps, dropSpots, matches, matchStats, tournaments,
    standings, opponents, opponentSpots, events, attendance, notes,
    announcements, activity, profiles,
  ].find((r) => r.error)?.error

  if (firstError) throw firstError

  return {
    settings: settings.data,
    players: players.data || [],
    maps: maps.data || [],
    dropSpots: dropSpots.data || [],
    matches: matches.data || [],
    matchStats: matchStats.data || [],
    tournaments: tournaments.data || [],
    standings: standings.data || [],
    opponents: opponents.data || [],
    opponentSpots: opponentSpots.data || [],
    events: events.data || [],
    attendance: attendance.data || [],
    notes: notes.data || [],
    announcements: announcements.data || [],
    activity: activity.data || [],
    profiles: profiles.data || [],
  }
}

/* ---------------------------------------------------------------------------
 * GENERIC CRUD — used by most forms
 * ------------------------------------------------------------------------- */

/** Insert a row, or update it when `values.id` is present. */
export async function saveRow(table, values) {
  const { id, ...rest } = values
  const query = id
    ? supabase.from(table).update(rest).eq('id', id).select().single()
    : supabase.from(table).insert(rest).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------------------
 * MATCHES — the one write that needs extra care, because a match is really
 * two things: the match row, plus one stat row per player who played.
 * ------------------------------------------------------------------------- */

/**
 * Creates or updates a match together with its per-player stat rows.
 * The database triggers then recalculate points and every team total.
 *
 * @param {object} match       the match fields (include `id` to edit)
 * @param {Array}  playerRows  [{ player_id, finishes, damage, ... }]
 */
export async function saveMatch(match, playerRows = []) {
  const { id, ...fields } = match

  // 1. The match row itself
  const { data: saved, error } = id
    ? await supabase.from('matches').update(fields).eq('id', id).select().single()
    : await supabase.from('matches').insert(fields).select().single()
  if (error) throw error

  const matchId = saved.id

  // 2. Replace the stat rows. Clearing them first means a player removed from
  //    the line-up during an edit does not leave an orphan row behind.
  if (id) {
    const { error: delError } = await supabase
      .from('match_player_stats')
      .delete()
      .eq('match_id', matchId)
    if (delError) throw delError
  }

  // 3. Write the stat rows for everyone who played
  if (playerRows.length) {
    const rows = playerRows.map((r) => ({ ...r, match_id: matchId }))
    const { error: statsError } = await supabase
      .from('match_player_stats')
      .upsert(rows, { onConflict: 'match_id,player_id' })
    if (statsError) throw statsError
  }

  // 4. Read the match back — the triggers have now filled in the points
  const { data: fresh } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  return fresh || saved
}

/** Deleting a match also deletes its stat rows (ON DELETE CASCADE). */
export async function deleteMatch(id) {
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------------------
 * ATTENDANCE
 * ------------------------------------------------------------------------- */
export async function setAttendance(eventId, playerId, status, note = null) {
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { event_id: eventId, player_id: playerId, status, note },
      { onConflict: 'event_id,player_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/* ---------------------------------------------------------------------------
 * SETTINGS
 * ------------------------------------------------------------------------- */
export async function saveSettings(values) {
  const { data, error } = await supabase
    .from('team_settings')
    .update(values)
    .eq('id', 1)
    .select()
    .single()
  if (error) throw error
  return data
}

/* ---------------------------------------------------------------------------
 * USERS
 * ------------------------------------------------------------------------- */
export async function updateProfile(id, values) {
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/* ---------------------------------------------------------------------------
 * FILE UPLOADS (player photos, match screenshots, team logo)
 * ------------------------------------------------------------------------- */

/**
 * Uploads a file to one of the public storage buckets and returns its URL.
 * @param {'avatars'|'screenshots'|'branding'} bucket
 */
export async function uploadFile(bucket, file, prefix = '') {
  if (!file) return null

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${prefix ? prefix + '/' : ''}${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/* ---------------------------------------------------------------------------
 * ACTIVITY LOG
 * ------------------------------------------------------------------------- */
export async function fetchActivity(limit = 200) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function clearActivity(beforeIso) {
  const { error } = await supabase.from('activity_log').delete().lt('created_at', beforeIso)
  if (error) throw error
}
