/**
 * Records & Achievements — the hall of fame.
 * Team records, individual bests, and milestone progress for every player.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Medal, Trophy, Flame, Crosshair, Zap, Target } from 'lucide-react'
import { useData } from '@/context/DataContext'
import {
  buildRecords,
  aggregateForPlayer,
  derivePlayerStats,
  MILESTONES,
} from '@/lib/stats'
import { num, dateShort, ordinal } from '@/lib/format'

import { Card, EmptyState, PageHeader, ProgressBar, Badge } from '@/components/ui/Primitives'

import { Avatar } from '@/components/ui/Avatar'

/** One big record tile. */
function RecordCard({ icon: Icon, label, value, suffix = '', holder, match, color }) {
  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="label">{label}</p>
        <Icon size={16} style={{ color: color || 'var(--color-accent)' }} />
      </div>
      <p className="num my-2 text-5xl" style={{ color: color || 'var(--color-accent)' }}>
        {value}
        {suffix}
      </p>
      <div className="text-xs text-muted">
        {holder && <p className="font-semibold text-fg">{holder}</p>}
        {match && (
          <Link to={`/matches/${match.id}`} className="hover:text-accent">
            {dateShort(match.played_at)} · {ordinal(match.placement)} place
          </Link>
        )}
      </div>
    </Card>
  )
}

export default function Records() {
  const { matches, matchStats, players, statsIndex, manualIndex, mapName } = useData()

  const records = useMemo(
    () => buildRecords(matches, matchStats, players),
    [matches, matchStats, players],
  )

  /** Milestone progress for every player. */
  const milestones = useMemo(() => {
    const teamFinishes = matches.reduce((a, m) => a + (m.team_finishes || 0), 0)
    return players
      .map((player) => {
        // Milestones are lifetime counters, so carry-over totals count
        // towards them. (The single-match records above cannot use them —
        // a carried-over total is not one match.)
        const derived = derivePlayerStats(
          aggregateForPlayer(player.id, matches, statsIndex, manualIndex.forPlayer(player.id)),
          teamFinishes,
        )
        const achieved = []
        const next = []

        for (const milestone of MILESTONES) {
          const value = derived[milestone.key] || 0
          const passed = milestone.steps.filter((step) => value >= step)
          const upcoming = milestone.steps.find((step) => value < step)

          if (passed.length) {
            achieved.push({
              label: `${num(passed[passed.length - 1])} ${milestone.label}`,
              key: milestone.key,
            })
          }
          if (upcoming) {
            next.push({
              label: milestone.label,
              value,
              target: upcoming,
              pct: (value / upcoming) * 100,
            })
          }
        }

        return { player, derived, achieved, next }
      })
      .filter((row) => row.derived.matches > 0)
  }, [players, matches, statsIndex])

  if (!matches.length) {
    return (
      <>
        <PageHeader title="Records" />
        <EmptyState
          icon={Medal}
          title="No records yet"
          message="Play and log a few matches — the hall of fame fills itself in."
        />
      </>
    )
  }

  const { team, player: best } = records

  return (
    <>
      <PageHeader title="Records & Achievements" subtitle="The hall of fame" />

      {/* --------------------------------------------------- team records --- */}
      <h2 className="label mb-2">Team records</h2>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RecordCard
          icon={Crosshair}
          label="Most finishes in a match"
          value={team.mostKills?.team_finishes ?? 0}
          match={team.mostKills}
          holder={team.mostKills ? mapName(team.mostKills.map_id) : null}
        />
        <RecordCard
          icon={Target}
          label="Highest points in a match"
          value={team.mostPoints?.total_points ?? 0}
          match={team.mostPoints}
          holder={team.mostPoints ? mapName(team.mostPoints.map_id) : null}
        />
        <RecordCard
          icon={Flame}
          label="Highest damage in a match"
          value={num(team.mostDamage?.team_damage ?? 0)}
          match={team.mostDamage}
          holder={team.mostDamage ? mapName(team.mostDamage.map_id) : null}
          color="#dc2626"
        />
        <RecordCard
          icon={Trophy}
          label="Longest WWCD streak"
          value={team.wwcdStreak}
          suffix={team.wwcdStreak === 1 ? ' win' : ' wins'}
          holder="In a row"
          color="#f5c518"
        />
      </div>

      {/* --------------------------------------------- individual records --- */}
      <h2 className="label mb-2">Individual records</h2>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <RecordCard
          icon={Crosshair}
          label="Most kills in one match"
          value={best.mostKills?.value ?? 0}
          holder={best.mostKills?.player}
          match={best.mostKills?.match}
        />
        <RecordCard
          icon={Flame}
          label="Highest damage in one match"
          value={num(best.mostDamage?.value ?? 0)}
          holder={best.mostDamage?.player}
          match={best.mostDamage?.match}
          color="#dc2626"
        />
        <RecordCard
          icon={Zap}
          label="Longest kill"
          value={num(best.longestKill?.value ?? 0)}
          suffix=" m"
          holder={best.longestKill?.player}
          match={best.longestKill?.match}
          color="#0284c7"
        />
      </div>

      {/* ----------------------------------------------------- milestones --- */}
      <h2 className="label mb-2">Player milestones</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {milestones.map(({ player, derived, achieved, next }) => (
          <Card key={player.id}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar
                src={player.photo_url}
                name={player.ign}
                role={player.primary_role}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/players/${player.id}`}
                  className="font-head font-semibold text-fg hover:text-accent"
                >
                  {player.ign}
                </Link>
                <p className="text-xs text-muted">
                  {derived.matches} matches · {derived.finishes} finishes
                </p>
              </div>
            </div>

            {/* Unlocked */}
            {achieved.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {achieved.map((item) => (
                  <Badge key={item.key} color="#f59e0b" size="sm">
                    🏅 {item.label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Working towards */}
            <div className="space-y-2">
              {next.slice(0, 3).map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted">
                      Next: {num(item.target)} {item.label}
                    </span>
                    <span className="font-head font-semibold text-fg">
                      {num(item.value)} / {num(item.target)}
                    </span>
                  </div>
                  <ProgressBar value={item.pct} height={5} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
