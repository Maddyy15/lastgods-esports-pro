/**
 * Every fixed list the app uses lives here, so labels and colours stay
 * identical on every page. If you ever rename a role or a status, change it
 * in this one file.
 */

/* ---------------------------------------------------------------------------
 * WEBSITE PERMISSION LEVELS
 * ------------------------------------------------------------------------- */
export const APP_ROLES = {
  owner: { label: 'Owner', rank: 5, color: '#f59e0b' },
  admin: { label: 'Admin', rank: 4, color: '#f97316' },
  coach: { label: 'Coach', rank: 3, color: '#a855f7' },
  analyst: { label: 'Analyst', rank: 3, color: '#38bdf8' },
  player: { label: 'Player', rank: 2, color: '#22c55e' },
  viewer: { label: 'Viewer', rank: 1, color: '#8d95a6' },
}

export const APP_ROLE_OPTIONS = Object.entries(APP_ROLES).map(([value, r]) => ({
  value,
  label: r.label,
}))

/** Anyone who may add or edit match / player data. */
export const STAFF_ROLES = ['owner', 'admin', 'coach', 'analyst']
/** Anyone who may change settings, maps and users. */
export const ADMIN_ROLES = ['owner', 'admin']

/* ---------------------------------------------------------------------------
 * BGMI IN-GAME ROLES
 * ------------------------------------------------------------------------- */
export const GAME_ROLES = {
  igl: { label: 'IGL', full: 'In-Game Leader', color: '#a855f7' },
  assaulter: { label: 'Assaulter', full: 'Assaulter / Entry Fragger', color: '#ef4444' },
  support: { label: 'Support', full: 'Support', color: '#22c55e' },
  sniper: { label: 'Sniper', full: 'Sniper / Scout', color: '#38bdf8' },
  filler: { label: 'Filler', full: 'Filler / Flex', color: '#f59e0b' },
}

export const GAME_ROLE_OPTIONS = Object.entries(GAME_ROLES).map(([value, r]) => ({
  value,
  label: r.full,
}))

/* ---------------------------------------------------------------------------
 * ROSTER STATUS
 * ------------------------------------------------------------------------- */
export const PLAYER_STATUS = {
  active: { label: 'Active', color: '#22c55e' },
  substitute: { label: 'Substitute', color: '#38bdf8' },
  trial: { label: 'Trial', color: '#eab308' },
  inactive: { label: 'Inactive', color: '#8d95a6' },
}

export const PLAYER_STATUS_OPTIONS = Object.entries(PLAYER_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}))

/* ---------------------------------------------------------------------------
 * MATCHES
 * ------------------------------------------------------------------------- */
export const MATCH_TYPES = {
  scrim: { label: 'Scrim', color: '#38bdf8' },
  tournament: { label: 'Tournament', color: '#f59e0b' },
  practice: { label: 'Practice', color: '#22c55e' },
  ranked: { label: 'Ranked', color: '#a855f7' },
}

export const MATCH_TYPE_OPTIONS = Object.entries(MATCH_TYPES).map(([value, t]) => ({
  value,
  label: t.label,
}))

export const STAGE_OPTIONS = [
  { value: 'Qualifiers', label: 'Qualifiers' },
  { value: 'League', label: 'League' },
  { value: 'Semi-Finals', label: 'Semi-Finals' },
  { value: 'Grand Finals', label: 'Grand Finals' },
]

export const PHASE_OPTIONS = [
  { value: 'early', label: 'Early game' },
  { value: 'mid', label: 'Mid game' },
  { value: 'late', label: 'Late game' },
  { value: 'survived', label: 'Survived (we won)' },
]

export const ZONE_SIDE_OPTIONS = ['North', 'South', 'East', 'West', 'Centre'].map((v) => ({
  value: v,
  label: v,
}))

export const ROTATION_OPTIONS = ['Early', 'On-time', 'Late'].map((v) => ({
  value: v,
  label: v,
}))

/* ---------------------------------------------------------------------------
 * TOURNAMENTS / SCHEDULE
 * ------------------------------------------------------------------------- */
export const TOURNAMENT_STATUS = {
  upcoming: { label: 'Upcoming', color: '#38bdf8' },
  ongoing: { label: 'Ongoing', color: '#22c55e' },
  completed: { label: 'Completed', color: '#8d95a6' },
}

export const TOURNAMENT_STATUS_OPTIONS = Object.entries(TOURNAMENT_STATUS).map(
  ([value, s]) => ({ value, label: s.label }),
)

export const TOURNAMENT_TIER_OPTIONS = [
  { value: 'Official', label: 'Official' },
  { value: 'Third-party', label: 'Third-party' },
  { value: 'Scrim league', label: 'Scrim league' },
  { value: 'Community', label: 'Community' },
]

export const EVENT_TYPES = {
  scrim: { label: 'Scrim', color: '#38bdf8' },
  tournament: { label: 'Tournament', color: '#f59e0b' },
  practice: { label: 'Practice', color: '#22c55e' },
  meeting: { label: 'Meeting', color: '#a855f7' },
}

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, e]) => ({
  value,
  label: e.label,
}))

export const ATTENDANCE_STATUS = {
  available: { label: 'Available', color: '#22c55e' },
  not_available: { label: 'Not available', color: '#ef4444' },
  maybe: { label: 'Maybe', color: '#eab308' },
}

/* ---------------------------------------------------------------------------
 * DEFAULTS — used before team settings load, and as a reset target
 * ------------------------------------------------------------------------- */
export const DEFAULT_POINTS_TABLE = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
}

export const DEFAULT_RATING_WEIGHTS = {
  finishes: 30,
  damage: 25,
  assists: 10,
  survival: 20,
  revives: 15,
}

export const DEFAULT_SETTINGS = {
  id: 1,
  team_name: 'LastGods Esports',
  tagline: 'Drop. Dominate. Repeat.',
  logo_url: null,
  accent_color: '#f59e0b',
  auto_calculate_totals: true,
  manual_totals: {},
  points_table: DEFAULT_POINTS_TABLE,
  rating_weights: DEFAULT_RATING_WEIGHTS,
}

/** Colour for a finishing position, used by the form strip and tables. */
export function placementColor(placement) {
  if (placement === 1) return '#f59e0b' // WWCD — gold
  if (placement <= 3) return '#22c55e' // podium — green
  if (placement <= 5) return '#38bdf8' // top 5 — blue
  if (placement <= 10) return '#eab308' // top 10 — yellow
  return '#ef4444' // bottom half — red
}

/** Date-range presets used by the leaderboard and other filters. */
export const DATE_RANGES = [
  { value: 'all', label: 'All time', days: null },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
]
