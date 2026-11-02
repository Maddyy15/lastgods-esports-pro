/**
 * ===========================================================================
 * THE STATS ENGINE
 * ===========================================================================
 * Every number shown anywhere in this app is calculated here, from the raw
 * `matches` and `match_player_stats` rows. Nothing is stored pre-summed
 * (except match points, which the database calculates), so when you edit or
 * delete a match, every total, map breakdown and leaderboard updates by
 * itself — there is no second copy of the data that can go out of sync.
 *
 * The usual flow on a page is:
 *    1. filterMatches(...)        -> narrow down which matches to look at
 *    2. aggregateForPlayer(...)   -> raw sums for one player
 *    3. derivePlayerStats(...)    -> K/D, ADR, headshot %, rating, ...
 */
import { DEFAULT_RATING_WEIGHTS, DEFAULT_POINTS_TABLE } from './constants'
import { safeDiv } from './format'

/* ---------------------------------------------------------------------------
 * Blank totals object. Every aggregate starts from a copy of this.
 * ------------------------------------------------------------------------- */
export function emptyTotals() {
  return {
    matches: 0,
    finishes: 0,
    knocks: 0,
    assists: 0,
    damage: 0,
    headshots: 0,
    revives: 0,
    survival_seconds: 0,
    throwable_damage: 0,
    utility_used: 0,
    vehicle_kills: 0,
    heals_used: 0,
    boosts_used: 0,
    mvps: 0,
    longest_kill: 0,
    // match-level (only counted for matches the player actually played)
    wwcd: 0,
    top5: 0,
    top10: 0,
    placementSum: 0,
    points: 0,
  }
}

/** Adds one match_player_stats row into a totals object. */
function addStatRow(totals, row) {
  totals.finishes += row.finishes || 0
  totals.knocks += row.knocks || 0
  totals.assists += row.assists || 0
  totals.damage += row.damage || 0
  totals.headshots += row.headshots || 0
  totals.revives += row.revives || 0
  totals.survival_seconds += row.survival_seconds || 0
  totals.throwable_damage += row.throwable_damage || 0
  totals.utility_used += row.utility_used || 0
  totals.vehicle_kills += row.vehicle_kills || 0
  totals.heals_used += row.heals_used || 0
  totals.boosts_used += row.boosts_used || 0
  totals.mvps += row.is_mvp ? 1 : 0
  totals.longest_kill = Math.max(totals.longest_kill, Number(row.longest_kill) || 0)
}

/** Adds the match-level result (placement, points) into a totals object. */
function addMatchResult(totals, match) {
  totals.placementSum += match.placement || 0
  totals.points += match.total_points || 0
  if (match.placement === 1) totals.wwcd += 1
  if (match.placement <= 5) totals.top5 += 1
  if (match.placement <= 10) totals.top10 += 1
}

/* ---------------------------------------------------------------------------
 * INDEXING — group the flat stats array by match and by player once, so the
 * pages can look things up instantly instead of scanning the whole array.
 * ------------------------------------------------------------------------- */
export function indexStats(statRows = []) {
  const byMatch = new Map()
  const byPlayer = new Map()
  for (const row of statRows) {
    if (!byMatch.has(row.match_id)) byMatch.set(row.match_id, [])
    byMatch.get(row.match_id).push(row)
    if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, [])
    byPlayer.get(row.player_id).push(row)
  }
  return { byMatch, byPlayer }
}

/* ---------------------------------------------------------------------------
 * FILTERING
 * ------------------------------------------------------------------------- */
/**
 * Narrows a list of matches.
 * @param {object} f  { mapId, matchType, tournamentId, dropSpotId, playerId,
 *                      days, from, to, placement, search }
 */
export function filterMatches(matches = [], f = {}, statsIndex = null) {
  let out = matches

  if (f.mapId && f.mapId !== 'all') out = out.filter((m) => m.map_id === f.mapId)
  if (f.matchType && f.matchType !== 'all')
    out = out.filter((m) => m.match_type === f.matchType)
  if (f.tournamentId && f.tournamentId !== 'all')
    out = out.filter((m) => m.tournament_id === f.tournamentId)
  if (f.dropSpotId && f.dropSpotId !== 'all')
    out = out.filter((m) => m.drop_spot_id === f.dropSpotId)
  if (f.stage && f.stage !== 'all') out = out.filter((m) => m.stage === f.stage)

  if (f.placement && f.placement !== 'all') {
    if (f.placement === 'wwcd') out = out.filter((m) => m.placement === 1)
    else if (f.placement === 'top5') out = out.filter((m) => m.placement <= 5)
    else if (f.placement === 'top10') out = out.filter((m) => m.placement <= 10)
    else if (f.placement === 'below10') out = out.filter((m) => m.placement > 10)
  }

  if (f.days) {
    const cutoff = Date.now() - Number(f.days) * 24 * 60 * 60 * 1000
    out = out.filter((m) => new Date(m.played_at).getTime() >= cutoff)
  }
  if (f.from) {
    const from = new Date(f.from).getTime()
    out = out.filter((m) => new Date(m.played_at).getTime() >= from)
  }
  if (f.to) {
    // include the whole "to" day
    const to = new Date(f.to).getTime() + 24 * 60 * 60 * 1000
    out = out.filter((m) => new Date(m.played_at).getTime() <= to)
  }

  // Only matches a particular player appeared in
  if (f.playerId && f.playerId !== 'all' && statsIndex) {
    out = out.filter((m) =>
      (statsIndex.byMatch.get(m.id) || []).some((s) => s.player_id === f.playerId),
    )
  }

  if (f.search) {
    const q = f.search.toLowerCase()
    out = out.filter(
      (m) =>
        (m.scrim_name || '').toLowerCase().includes(q) ||
        (m.eliminated_by || '').toLowerCase().includes(q) ||
        (m.stage || '').toLowerCase().includes(q) ||
        (m.coach_notes || '').toLowerCase().includes(q),
    )
  }

  return out
}

/* ---------------------------------------------------------------------------
 * TEAM AGGREGATE
 * ------------------------------------------------------------------------- */
export function aggregateTeam(matches = []) {
  const t = emptyTotals()
  t.matches = matches.length
  for (const m of matches) {
    t.finishes += m.team_finishes || 0
    t.damage += m.team_damage || 0
    addMatchResult(t, m)
  }
  return t
}

/** Team-level derived numbers for the dashboard. */
export function deriveTeam(totals) {
  const n = totals.matches
  return {
    ...totals,
    winRate: n ? (totals.wwcd / n) * 100 : 0,
    top5Rate: n ? (totals.top5 / n) * 100 : 0,
    top10Rate: n ? (totals.top10 / n) * 100 : 0,
    avgPlacement: safeDiv(totals.placementSum, n, 2),
    avgPoints: safeDiv(totals.points, n, 2),
    avgFinishes: safeDiv(totals.finishes, n, 2),
    avgDamage: safeDiv(totals.damage, n, 0),
  }
}

/* ---------------------------------------------------------------------------
 * PLAYER AGGREGATE
 * ------------------------------------------------------------------------- */
/**
 * Raw sums for one player across a given list of matches.
 * Matches the player did not play in are skipped automatically.
 */
export function aggregateForPlayer(playerId, matches = [], statsIndex) {
  const t = emptyTotals()
  if (!statsIndex) return t

  for (const m of matches) {
    const rows = statsIndex.byMatch.get(m.id)
    if (!rows) continue
    const row = rows.find((r) => r.player_id === playerId)
    if (!row) continue
    t.matches += 1
    addStatRow(t, row)
    addMatchResult(t, m)
  }
  return t
}

/**
 * Turns raw sums into the numbers people actually read.
 * @param teamFinishes  total team finishes over the same matches, used for
 *                      the "contribution %" stat.
 */
export function derivePlayerStats(totals, teamFinishes = 0) {
  const n = totals.matches || 0
  return {
    ...totals,
    kd: safeDiv(totals.finishes, n, 2), // finishes per match played
    avgDamage: safeDiv(totals.damage, n, 0),
    avgFinishes: safeDiv(totals.finishes, n, 2),
    avgAssists: safeDiv(totals.assists, n, 2),
    avgKnocks: safeDiv(totals.knocks, n, 2),
    headshotPct: totals.finishes ? (totals.headshots / totals.finishes) * 100 : 0,
    damagePerKill: safeDiv(totals.damage, totals.finishes, 0),
    knockConversion: totals.knocks ? (totals.finishes / totals.knocks) * 100 : 0,
    avgSurvival: safeDiv(totals.survival_seconds, n, 0),
    avgRevives: safeDiv(totals.revives, n, 2),
    avgUtility: safeDiv(totals.utility_used, n, 1),
    contributionPct: teamFinishes ? (totals.finishes / teamFinishes) * 100 : 0,
    avgPlacement: safeDiv(totals.placementSum, n, 2),
    winRate: n ? (totals.wwcd / n) * 100 : 0,
  }
}

/* ---------------------------------------------------------------------------
 * PLAYER RATING (0 – 100)
 * ---------------------------------------------------------------------------
 * Each part of a player's game is scored against a "100% benchmark" — the
 * per-match number we treat as an elite performance. The five scores are then
 * mixed using the weights from Settings (which must add up to 100).
 *
 * Example with the default weights: a player averaging 5 finishes, 800 damage,
 * 3 assists, 18 minutes alive and 1.5 revives per match would rate 100.
 */
export const RATING_BENCHMARKS = {
  finishes: 5, // finishes per match
  damage: 800, // damage per match
  assists: 3, // assists per match
  survival: 1080, // seconds alive per match (18 minutes)
  revives: 1.5, // revives per match
}

export function playerRating(derived, weights = DEFAULT_RATING_WEIGHTS) {
  if (!derived || !derived.matches) return 0

  const w = { ...DEFAULT_RATING_WEIGHTS, ...(weights || {}) }
  const totalWeight = Object.values(w).reduce((a, b) => a + (Number(b) || 0), 0) || 100

  // Each component scores 0–1 against its benchmark (capped at 1.2 so one
  // monster stat cannot carry a player past a realistic score).
  const score = (value, benchmark) => Math.min(1.2, (Number(value) || 0) / benchmark)

  const parts =
    score(derived.avgFinishes, RATING_BENCHMARKS.finishes) * (Number(w.finishes) || 0) +
    score(derived.avgDamage, RATING_BENCHMARKS.damage) * (Number(w.damage) || 0) +
    score(derived.avgAssists, RATING_BENCHMARKS.assists) * (Number(w.assists) || 0) +
    score(derived.avgSurvival, RATING_BENCHMARKS.survival) * (Number(w.survival) || 0) +
    score(derived.avgRevives, RATING_BENCHMARKS.revives) * (Number(w.revives) || 0)

  return Math.max(0, Math.min(100, Math.round((parts / totalWeight) * 100)))
}

/** The five axes of the radar chart, each scaled 0–100. */
export function radarProfile(derived) {
  const cap = (v) => Math.max(0, Math.min(100, Math.round(v)))
  return [
    { axis: 'Fragging', value: cap((derived.avgFinishes / RATING_BENCHMARKS.finishes) * 100) },
    { axis: 'Damage', value: cap((derived.avgDamage / RATING_BENCHMARKS.damage) * 100) },
    { axis: 'Support', value: cap((derived.avgAssists / RATING_BENCHMARKS.assists) * 100) },
    { axis: 'Survival', value: cap((derived.avgSurvival / RATING_BENCHMARKS.survival) * 100) },
    { axis: 'Utility', value: cap((derived.avgUtility / 8) * 100) },
  ]
}

/* ---------------------------------------------------------------------------
 * MAP-WISE BREAKDOWN
 * ------------------------------------------------------------------------- */
/**
 * One row per map for a single player: matches, kills, damage, K/D, HS%, MVPs
 * and that player's best match on the map. This powers the map-wise table on
 * the player profile.
 */
export function playerByMap(playerId, matches, statsIndex, maps = []) {
  return maps
    .map((map) => {
      const mapMatches = matches.filter((m) => m.map_id === map.id)
      const totals = aggregateForPlayer(playerId, mapMatches, statsIndex)
      const teamFinishes = mapMatches.reduce((a, m) => a + (m.team_finishes || 0), 0)
      const derived = derivePlayerStats(totals, teamFinishes)

      // Best single match on this map, judged by finishes then damage
      let best = null
      for (const m of mapMatches) {
        const row = (statsIndex.byMatch.get(m.id) || []).find(
          (r) => r.player_id === playerId,
        )
        if (!row) continue
        if (
          !best ||
          row.finishes > best.row.finishes ||
          (row.finishes === best.row.finishes && row.damage > best.row.damage)
        ) {
          best = { row, match: m }
        }
      }

      return { map, ...derived, best }
    })
    .filter((r) => r.matches > 0)
}

/** Team performance per map — used by the Maps page. */
export function teamByMap(matches, maps = []) {
  return maps
    .map((map) => {
      const mapMatches = matches.filter((m) => m.map_id === map.id)
      return { map, ...deriveTeam(aggregateTeam(mapMatches)) }
    })
    .filter((r) => r.matches > 0)
}

/** Team performance per drop spot — used by the Drop Spot Analysis page. */
export function teamByDropSpot(matches, dropSpots = [], maps = []) {
  const mapName = new Map(maps.map((m) => [m.id, m.name]))

  return dropSpots
    .map((spot) => {
      const spotMatches = matches.filter((m) => m.drop_spot_id === spot.id)
      const agg = deriveTeam(aggregateTeam(spotMatches))
      const contested = spotMatches.filter((m) => m.contested).length
      // "Survived the early game" = we were not eliminated in the early phase
      const survivedEarly = spotMatches.filter(
        (m) => m.eliminated_phase !== 'early',
      ).length

      return {
        spot,
        mapName: mapName.get(spot.map_id) || '—',
        ...agg,
        contested,
        contestedRate: agg.matches ? (contested / agg.matches) * 100 : 0,
        earlySurvivalRate: agg.matches ? (survivedEarly / agg.matches) * 100 : 0,
      }
    })
    .filter((r) => r.matches > 0)
}

/* ---------------------------------------------------------------------------
 * LEADERBOARD
 * ------------------------------------------------------------------------- */
/** Full derived stat line for every player, ready to be sorted. */
export function buildLeaderboard(players, matches, statsIndex, weights) {
  const teamFinishes = matches.reduce((a, m) => a + (m.team_finishes || 0), 0)

  return players
    .map((player) => {
      const totals = aggregateForPlayer(player.id, matches, statsIndex)
      const derived = derivePlayerStats(totals, teamFinishes)
      return { player, ...derived, rating: playerRating(derived, weights) }
    })
    .filter((r) => r.matches > 0)
}

/** Sorting options offered on the Leaderboard page. */
export const LEADERBOARD_METRICS = [
  { value: 'finishes', label: 'Finishes', format: 'int' },
  { value: 'damage', label: 'Damage', format: 'int' },
  { value: 'kd', label: 'K/D', format: 'dec' },
  { value: 'avgDamage', label: 'Avg Damage', format: 'int' },
  { value: 'headshotPct', label: 'Headshot %', format: 'pct' },
  { value: 'assists', label: 'Assists', format: 'int' },
  { value: 'revives', label: 'Revives', format: 'int' },
  { value: 'mvps', label: 'MVPs', format: 'int' },
  { value: 'rating', label: 'Player Rating', format: 'int' },
  { value: 'survival_seconds', label: 'Survival Time', format: 'time' },
  { value: 'knocks', label: 'Knocks', format: 'int' },
  { value: 'contributionPct', label: 'Kill Contribution %', format: 'pct' },
]

/* ---------------------------------------------------------------------------
 * CHART SERIES
 * ------------------------------------------------------------------------- */
/** Last N matches as chart points: points, finishes, damage, placement. */
export function teamTrend(matches, limit = 20) {
  return [...matches]
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
    .slice(-limit)
    .map((m, i) => ({
      i: i + 1,
      label: `#${m.match_number ?? i + 1}`,
      points: m.total_points || 0,
      finishes: m.team_finishes || 0,
      damage: m.team_damage || 0,
      placement: m.placement,
      date: m.played_at,
    }))
}

/** Last N matches for one player. */
export function playerTrend(playerId, matches, statsIndex, limit = 20) {
  return [...matches]
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
    .map((m) => {
      const row = (statsIndex.byMatch.get(m.id) || []).find(
        (r) => r.player_id === playerId,
      )
      return row ? { match: m, row } : null
    })
    .filter(Boolean)
    .slice(-limit)
    .map(({ match, row }, i) => ({
      i: i + 1,
      label: `#${match.match_number ?? i + 1}`,
      finishes: row.finishes,
      damage: row.damage,
      assists: row.assists,
      placement: match.placement,
      date: match.played_at,
    }))
}

/** How often we finish in each bracket — the placement distribution chart. */
export function placementDistribution(matches) {
  const buckets = [
    { label: 'WWCD', test: (p) => p === 1, color: '#f59e0b' },
    { label: '2-3', test: (p) => p >= 2 && p <= 3, color: '#22c55e' },
    { label: '4-5', test: (p) => p >= 4 && p <= 5, color: '#38bdf8' },
    { label: '6-10', test: (p) => p >= 6 && p <= 10, color: '#eab308' },
    { label: '11+', test: (p) => p > 10, color: '#ef4444' },
  ]
  return buckets.map((b) => ({
    name: b.label,
    value: matches.filter((m) => b.test(m.placement)).length,
    color: b.color,
  }))
}

/** The coloured chips showing our last N results. Newest first. */
export function formStrip(matches, limit = 10) {
  return [...matches]
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, limit)
    .map((m) => ({ id: m.id, placement: m.placement, date: m.played_at }))
}

/** The same strip, but only matches a given player appeared in. */
export function playerFormStrip(playerId, matches, statsIndex, limit = 5) {
  return formStrip(
    matches.filter((m) =>
      (statsIndex.byMatch.get(m.id) || []).some((r) => r.player_id === playerId),
    ),
    limit,
  )
}

/* ---------------------------------------------------------------------------
 * RECORDS
 * ------------------------------------------------------------------------- */
/** Best single-match performances, team and individual. */
export function buildRecords(matches, statRows, players) {
  const playerName = new Map(players.map((p) => [p.id, p.ign]))
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const visible = statRows.filter((r) => matchById.has(r.match_id))

  const topBy = (rows, key) =>
    rows.reduce(
      (best, r) => (!best || Number(r[key]) > Number(best[key]) ? r : best),
      null,
    )

  const bestKills = topBy(visible, 'finishes')
  const bestDamage = topBy(visible, 'damage')
  const bestLongest = topBy(visible, 'longest_kill')

  const teamBestKills = matches.reduce(
    (b, m) => (!b || (m.team_finishes || 0) > (b.team_finishes || 0) ? m : b),
    null,
  )
  const teamBestPoints = matches.reduce(
    (b, m) => (!b || (m.total_points || 0) > (b.total_points || 0) ? m : b),
    null,
  )
  const teamBestDamage = matches.reduce(
    (b, m) => (!b || (m.team_damage || 0) > (b.team_damage || 0) ? m : b),
    null,
  )

  // Longest run of consecutive WWCDs, oldest match first
  const chrono = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
  let streak = 0
  let bestStreak = 0
  for (const m of chrono) {
    streak = m.placement === 1 ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }

  const wrap = (row, key) =>
    row
      ? {
          value: Number(row[key]),
          player: playerName.get(row.player_id) || '—',
          playerId: row.player_id,
          match: matchById.get(row.match_id),
        }
      : null

  return {
    player: {
      mostKills: wrap(bestKills, 'finishes'),
      mostDamage: wrap(bestDamage, 'damage'),
      longestKill: wrap(bestLongest, 'longest_kill'),
    },
    team: {
      mostKills: teamBestKills,
      mostPoints: teamBestPoints,
      mostDamage: teamBestDamage,
      wwcdStreak: bestStreak,
    },
  }
}

/** Milestones like "100 finishes" — shown on the Records page. */
export const MILESTONES = [
  { key: 'finishes', label: 'Finishes', steps: [50, 100, 250, 500, 1000] },
  { key: 'damage', label: 'Damage', steps: [10000, 25000, 50000, 100000] },
  { key: 'mvps', label: 'MVPs', steps: [5, 10, 25, 50] },
  { key: 'wwcd', label: 'Chicken Dinners', steps: [1, 5, 10, 25] },
  { key: 'matches', label: 'Matches', steps: [25, 50, 100, 250] },
]

/* ---------------------------------------------------------------------------
 * POINTS
 * ------------------------------------------------------------------------- */
/**
 * The same calculation the database does, mirrored here so the Add Match form
 * can preview the points live while you type.
 */
export function calcPoints(placement, finishes, pointsTable = DEFAULT_POINTS_TABLE) {
  const table = pointsTable || DEFAULT_POINTS_TABLE
  const placementPts = Number(table[String(placement)]) || 0
  const finishPts = Number(finishes) || 0
  return { placementPts, finishPts, total: placementPts + finishPts }
}

/** Top performers over a period — used by the dashboard cards. */
export function topPerformers(players, matches, statsIndex, weights) {
  const board = buildLeaderboard(players, matches, statsIndex, weights)
  const best = (key) =>
    board.length ? [...board].sort((a, b) => b[key] - a[key])[0] : null
  return {
    kills: best('finishes'),
    damage: best('damage'),
    mvps: best('mvps'),
    rating: best('rating'),
  }
}
