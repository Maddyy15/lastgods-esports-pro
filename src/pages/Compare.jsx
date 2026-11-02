/**
 * Player Comparison — two players side by side, with a radar overlay.
 * Everything can be narrowed to one map, which is how you settle arguments
 * about who should take which role on Miramar.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, ArrowLeftRight } from 'lucide-react'
import { useData } from '@/context/DataContext'
import {
  aggregateForPlayer,
  manualScopeFor,
  derivePlayerStats,
  playerRating,
  radarProfile,
  filterMatches,
} from '@/lib/stats'
import { num, pct, duration, minutes, cx } from '@/lib/format'
import { MATCH_TYPE_OPTIONS } from '@/lib/constants'

import { Button, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/Primitives'
import { Select } from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadges } from '@/components/ui/Chips'
import { SkillRadar, SERIES } from '@/components/ui/Charts'

/** The rows of the comparison table. `better: 'low'` means lower wins. */
const COMPARISONS = [
  { key: 'matches', label: 'Matches played', fmt: (v) => num(v) },
  { key: 'finishes', label: 'Finishes', fmt: (v) => num(v) },
  { key: 'knocks', label: 'Knocks', fmt: (v) => num(v) },
  { key: 'assists', label: 'Assists', fmt: (v) => num(v) },
  { key: 'damage', label: 'Total damage', fmt: (v) => num(v) },
  { key: 'kd', label: 'K/D', fmt: (v) => v.toFixed(2) },
  { key: 'avgFinishes', label: 'Kills per match', fmt: (v) => v.toFixed(2) },
  { key: 'avgDamage', label: 'Avg damage', fmt: (v) => num(v) },
  { key: 'headshotPct', label: 'Headshot %', fmt: (v) => pct(v, 1) },
  { key: 'damagePerKill', label: 'Damage per kill', fmt: (v) => num(v), better: 'low' },
  { key: 'knockConversion', label: 'Knock → finish %', fmt: (v) => pct(v, 1) },
  { key: 'contributionPct', label: 'Kill contribution %', fmt: (v) => pct(v, 1) },
  { key: 'revives', label: 'Revives', fmt: (v) => num(v) },
  { key: 'avgRevives', label: 'Revives per match', fmt: (v) => v.toFixed(2) },
  { key: 'utility_used', label: 'Utility used', fmt: (v) => num(v) },
  { key: 'throwable_damage', label: 'Throwable damage', fmt: (v) => num(v) },
  { key: 'survival_seconds', label: 'Total survival', fmt: (v) => duration(v) },
  { key: 'avgSurvival', label: 'Avg survival', fmt: (v) => `${minutes(v, 1)} min` },
  { key: 'mvps', label: 'MVPs', fmt: (v) => num(v) },
  { key: 'wwcd', label: 'Chicken Dinners', fmt: (v) => num(v) },
  { key: 'avgPlacement', label: 'Avg placement', fmt: (v) => v.toFixed(2), better: 'low' },
  { key: 'longest_kill', label: 'Longest kill', fmt: (v) => `${num(v)} m` },
  { key: 'rating', label: 'Player rating', fmt: (v) => num(v), highlight: true },
]

export default function Compare() {
  const { players, matches, maps, statsIndex, manualIndex, settings } = useData()

  const [leftId, setLeftId] = useState(players[0]?.id || '')
  const [rightId, setRightId] = useState(players[1]?.id || '')
  const [mapId, setMapId] = useState('all')
  const [matchType, setMatchType] = useState('all')

  const scope = useMemo(
    () => filterMatches(matches, { mapId, matchType }, statsIndex),
    [matches, mapId, matchType, statsIndex],
  )

  // Carry-over totals apply while the comparison is all-time or map-only.
  // Picking a match type narrows it, and then they are dropped.
  const manualFor = useMemo(
    () => manualScopeFor({ mapId, matchType }, manualIndex),
    [mapId, matchType, manualIndex],
  )

  /** Builds the full stat line for one player within the current filters. */
  const statsFor = (playerId) => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return null
    const teamFinishes = scope.reduce((a, m) => a + (m.team_finishes || 0), 0)
    const derived = derivePlayerStats(
      aggregateForPlayer(playerId, scope, statsIndex, manualFor ? manualFor(playerId) : null),
      teamFinishes,
    )
    return {
      player,
      ...derived,
      rating: playerRating(derived, settings.rating_weights),
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const left = useMemo(() => statsFor(leftId), [leftId, scope, players, statsIndex, manualFor, settings])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const right = useMemo(() => statsFor(rightId), [rightId, scope, players, statsIndex, manualFor, settings])

  /** Radar data with one key per player, overlaid on the same axes. */
  const radarData = useMemo(() => {
    if (!left || !right) return []
    const l = radarProfile(left)
    const r = radarProfile(right)
    return l.map((entry, i) => ({ axis: entry.axis, a: entry.value, b: r[i].value }))
  }, [left, right])

  const swap = () => {
    setLeftId(rightId)
    setRightId(leftId)
  }

  if (players.length < 2) {
    return (
      <>
        <PageHeader title="Player Comparison" />
        <EmptyState
          icon={GitCompareArrows}
          title="Add at least two players"
          message="Comparison needs two people on the roster."
          action={
            <Link to="/roster">
              <Button>Go to roster</Button>
            </Link>
          }
        />
      </>
    )
  }

  const playerOptions = players.map((p) => ({ value: p.id, label: p.ign }))

  return (
    <>
      <PageHeader
        title="Player Comparison"
        subtitle={`Across ${scope.length} matches${mapId !== 'all' ? ' on this map' : ''}`}
      />

      {/* Pickers */}
      <Card className="mb-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Player A"
            options={playerOptions}
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
          />
          <div className="flex justify-center pb-1">
            <Button variant="secondary" size="icon" onClick={swap} title="Swap">
              <ArrowLeftRight size={16} />
            </Button>
          </div>
          <Select
            label="Player B"
            options={playerOptions}
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
          />
          <Select
            label="Map"
            options={[
              { value: 'all', label: 'All maps' },
              ...maps.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={mapId}
            onChange={(e) => setMapId(e.target.value)}
          />
          <Select
            label="Match type"
            options={[{ value: 'all', label: 'All types' }, ...MATCH_TYPE_OPTIONS]}
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
          />
        </div>
      </Card>

      {!left || !right ? (
        <EmptyState icon={GitCompareArrows} title="Pick two players to compare" />
      ) : leftId === rightId ? (
        <EmptyState
          icon={GitCompareArrows}
          title="Pick two different players"
          message="Choose a different player in one of the dropdowns."
        />
      ) : (
        <>
          {/* Heads */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            {[
              { side: left, color: SERIES[0] },
              { side: right, color: SERIES[1] },
            ].map(({ side, color }) => (
              <Card key={side.player.id} className="text-center" style={{ borderColor: `${color}55` }}>
                <div className="mb-2 flex justify-center">
                  <Avatar
                    src={side.player.photo_url}
                    name={side.player.ign}
                    role={side.player.primary_role}
                    size="lg"
                  />
                </div>
                <Link
                  to={`/players/${side.player.id}`}
                  className="font-head text-lg font-semibold text-fg hover:text-accent"
                >
                  {side.player.ign}
                </Link>
                <div className="mt-1 flex justify-center">
                  <RoleBadges
                    primary={side.player.primary_role}
                    secondary={side.player.secondary_role}
                    size="sm"
                  />
                </div>
                <p className="num mt-2 text-4xl" style={{ color }}>
                  {side.rating}
                </p>
                <p className="label">Rating</p>
              </Card>
            ))}
          </div>

          {/* Radar + damage bars */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <SkillRadar
              title="Skill profile overlay"
              subtitle="Each axis scored out of 100 against an elite benchmark"
              data={radarData}
              series={[
                { key: 'a', label: left.player.ign, color: SERIES[0] },
                { key: 'b', label: right.player.ign, color: SERIES[1] },
              ]}
              height={330}
            />
            {/* Per-match averages as paired bars. Each pair shares a scale,
                so the two lengths are directly comparable. */}
            <Card>
              <CardHeader
                title="Per-match averages"
                subtitle="Both bars in a pair share the same scale"
              />
              <div className="space-y-4">
                {[
                  { label: 'Kills per match', a: left.avgFinishes, b: right.avgFinishes, dp: 2 },
                  { label: 'Damage per match', a: left.avgDamage, b: right.avgDamage, dp: 0 },
                  { label: 'Assists per match', a: left.avgAssists, b: right.avgAssists, dp: 2 },
                  { label: 'Revives per match', a: left.avgRevives, b: right.avgRevives, dp: 2 },
                  { label: 'Utility per match', a: left.avgUtility, b: right.avgUtility, dp: 1 },
                  {
                    label: 'Minutes survived',
                    a: Number(minutes(left.avgSurvival, 1)),
                    b: Number(minutes(right.avgSurvival, 1)),
                    dp: 1,
                  },
                ].map((row) => {
                  const max = Math.max(row.a, row.b, 0.0001)
                  return (
                    <div key={row.label}>
                      <p className="label mb-1.5">{row.label}</p>
                      {[
                        { value: row.a, name: left.player.ign, color: SERIES[0] },
                        { value: row.b, name: right.player.ign, color: SERIES[1] },
                      ].map((bar) => (
                        <div key={bar.name} className="mb-1 flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-[11px] text-muted">
                            {bar.name}
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${(bar.value / max) * 100}%`,
                                backgroundColor: bar.color,
                              }}
                            />
                          </div>
                          <span className="w-14 shrink-0 text-right font-head text-xs font-semibold tabular-nums text-fg">
                            {num(bar.value, row.dp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* The table */}
          <Card>
            <CardHeader title="Side by side" icon={GitCompareArrows} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label py-2 text-right" style={{ color: SERIES[0] }}>
                      {left.player.ign}
                    </th>
                    <th className="label py-2 text-center">Stat</th>
                    <th className="label py-2 text-left" style={{ color: SERIES[1] }}>
                      {right.player.ign}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISONS.map((row) => {
                    const a = Number(left[row.key]) || 0
                    const b = Number(right[row.key]) || 0
                    const lower = row.better === 'low'
                    // Nobody "wins" a row where both are zero
                    const aWins = a !== b && (lower ? a < b : a > b) && (a || b)
                    const bWins = a !== b && (lower ? b < a : b > a) && (a || b)

                    return (
                      <tr
                        key={row.key}
                        className={cx(
                          'border-b border-line/60 last:border-0',
                          row.highlight && 'bg-accent/5',
                        )}
                      >
                        <td
                          className={cx(
                            'py-2 pr-3 text-right font-head tabular-nums',
                            aWins ? 'text-fg' : 'text-muted',
                          )}
                          style={aWins ? { color: SERIES[0], fontWeight: 700 } : undefined}
                        >
                          {row.fmt(a)}
                        </td>
                        <td className="w-[40%] px-2 py-2 text-center text-xs text-faint">
                          {row.label}
                        </td>
                        <td
                          className={cx(
                            'py-2 pl-3 text-left font-head tabular-nums',
                            bWins ? 'text-fg' : 'text-muted',
                          )}
                          style={bWins ? { color: SERIES[1], fontWeight: 700 } : undefined}
                        >
                          {row.fmt(b)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
