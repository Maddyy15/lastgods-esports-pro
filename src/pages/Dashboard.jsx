/**
 * Dashboard — the first screen everyone sees.
 *
 * Team totals are normally calculated live from every logged match. An Admin
 * or Coach can switch "Auto-calculate" off in Settings and type the totals in
 * by hand instead (useful if you are carrying over stats from before this
 * site existed) — this page respects that choice.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Target,
  Swords,
  Flame,
  Percent,
  Crosshair,
  CalendarDays,
  Megaphone,
  Activity,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import {
  aggregateTeam,
  deriveTeam,
  teamTrend,
  teamByMap,
  placementDistribution,
  formStrip,
  topPerformers,
} from '@/lib/stats'
import { num, dateTime, timeAgo, dateShort, timeOnly } from '@/lib/format'

import { Button, Card, CardHeader, EmptyState, Badge } from '@/components/ui/Primitives'
import { StatBox, StatGrid } from '@/components/ui/StatBox'
import { TeamLogo, Avatar } from '@/components/ui/Avatar'
import { FormStrip, EventTypeBadge } from '@/components/ui/Chips'
import { TrendLine, BarCompare, OrdinalBar, SERIES } from '@/components/ui/Charts'

/** Team totals come either from the matches, or from the manual override. */
function useTeamTotals() {
  const { matches, settings } = useData()

  return useMemo(() => {
    const live = deriveTeam(aggregateTeam(matches))
    if (settings.auto_calculate_totals) return { ...live, manual: false }

    // Manual mode: use any value the admin typed, fall back to the live one
    const manual = settings.manual_totals || {}
    const pick = (key) =>
      manual[key] === undefined || manual[key] === '' ? live[key] : Number(manual[key])

    return {
      ...live,
      matches: pick('matches'),
      wwcd: pick('wwcd'),
      winRate: pick('winRate'),
      finishes: pick('finishes'),
      damage: pick('damage'),
      points: pick('points'),
      avgPlacement: pick('avgPlacement'),
      avgPoints: pick('avgPoints'),
      avgFinishes: pick('avgFinishes'),
      top5Rate: pick('top5Rate'),
      manual: true,
    }
  }, [matches, settings])
}

export default function Dashboard() {
  const { can } = useAuth()
  const {
    settings,
    matches,
    maps,
    players,
    statsIndex,
    events,
    announcements,
    activity,
    tournaments,
  } = useData()

  const totals = useTeamTotals()

  /* ------------------------------------------------------------- charts */
  const trend = useMemo(() => teamTrend(matches, 20), [matches])
  const byMap = useMemo(() => teamByMap(matches, maps), [matches, maps])
  const distribution = useMemo(() => placementDistribution(matches), [matches])
  const form = useMemo(() => formStrip(matches, 10), [matches])

  /* -------------------------------------------- top performers by period */
  const performers = useMemo(() => {
    const since = (days) => {
      const cutoff = Date.now() - days * 86400000
      return matches.filter((m) => new Date(m.played_at).getTime() >= cutoff)
    }
    return {
      week: topPerformers(players, since(7), statsIndex, settings.rating_weights),
      month: topPerformers(players, since(30), statsIndex, settings.rating_weights),
    }
  }, [players, matches, statsIndex, settings.rating_weights])

  /* ------------------------------------------------- upcoming & pinned */
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.starts_at).getTime() > Date.now() - 2 * 3600000)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
        .slice(0, 4),
    [events],
  )

  const liveTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'ongoing' || t.status === 'upcoming').slice(0, 3),
    [tournaments],
  )

  const board = useMemo(
    () =>
      [...announcements]
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
        .slice(0, 3),
    [announcements],
  )

  const hasMatches = matches.length > 0

  return (
    <>
      {/* ------------------------------------------------- team header --- */}
      <Card glow className="mb-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <TeamLogo src={settings.logo_url} name={settings.team_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl leading-none font-semibold uppercase tracking-wide text-fg sm:text-5xl">
              {settings.team_name}
            </h1>
            <p className="mt-1 font-head text-sm uppercase tracking-[0.25em] text-accent">
              {settings.tagline}
            </p>
            <p className="mt-2 text-xs text-muted">
              {players.filter((p) => p.status === 'active').length} active players ·{' '}
              {matches.length} matches logged
            </p>
          </div>

          {hasMatches && (
            <div className="w-full sm:w-auto">
              <p className="label mb-1.5">Last 10 results</p>
              <FormStrip items={form} />
            </div>
          )}
        </div>
      </Card>

      {!hasMatches ? (
        <EmptyState
          icon={Swords}
          title="No matches yet"
          message="Log your first match and this dashboard will fill itself in — totals, charts, map performance and the leaderboard all come from your match data."
          action={
            can.editMatches && (
              <Link to="/matches?new=1">
                <Button>Add your first match</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* ------------------------------------------- team totals --- */}
          <div className="mb-2 flex items-center justify-between">
            <h2 className="label">Team totals</h2>
            {totals.manual && (
              <Badge color="#eab308" size="sm">
                Manual override on
              </Badge>
            )}
          </div>

          <StatGrid cols={5} className="mb-4">
            <StatBox label="Matches played" value={totals.matches} icon={Swords} />
            <StatBox
              label="Chicken Dinners"
              value={totals.wwcd}
              icon={Trophy}
              color="#f59e0b"
            />
            <StatBox
              label="Win rate"
              value={totals.winRate}
              decimals={1}
              suffix="%"
              icon={Percent}
            />
            <StatBox label="Total finishes" value={totals.finishes} icon={Crosshair} />
            <StatBox label="Total damage" value={totals.damage} icon={Flame} />
            <StatBox label="Total points" value={totals.points} icon={Target} color="var(--color-accent)" />
            <StatBox label="Avg placement" value={totals.avgPlacement} decimals={2} />
            <StatBox label="Avg points / match" value={totals.avgPoints} decimals={2} />
            <StatBox label="Avg kills / match" value={totals.avgFinishes} decimals={2} />
            <StatBox label="Top 5 rate" value={totals.top5Rate} decimals={1} suffix="%" />
          </StatGrid>

          {/* ---------------------------------------------- charts --- */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <TrendLine
              title="Points & finishes"
              subtitle="Last 20 matches"
              data={trend}
              series={[
                { key: 'points', label: 'Points' },
                { key: 'finishes', label: 'Finishes' },
              ]}
              height={250}
            />
            <OrdinalBar
              title="Placement distribution"
              subtitle="How often we finish in each bracket"
              data={distribution}
              height={250}
            />
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <BarCompare
              title="Average points by map"
              data={byMap.map((r) => ({ name: r.map.name, value: r.avgPoints }))}
              dataKey="value"
              label="Avg points"
              decimals={1}
              height={240}
            />
            <BarCompare
              title="Average finishes by map"
              data={byMap.map((r) => ({ name: r.map.name, value: r.avgFinishes }))}
              dataKey="value"
              label="Avg finishes"
              decimals={1}
              color={SERIES[1]}
              height={240}
            />
          </div>

          {/* ------------------------------------- top performers --- */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            {[
              { title: 'Top performers — last 7 days', data: performers.week },
              { title: 'Top performers — last 30 days', data: performers.month },
            ].map((block) => (
              <Card key={block.title}>
                <CardHeader title={block.title} icon={Zap} />
                {!block.data.kills ? (
                  <p className="py-6 text-center text-sm text-faint">
                    No matches in this period.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Most finishes', entry: block.data.kills, stat: (e) => e.finishes },
                      { label: 'Most damage', entry: block.data.damage, stat: (e) => num(e.damage) },
                      { label: 'Most MVPs', entry: block.data.mvps, stat: (e) => e.mvps },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        to={`/players/${item.entry.player.id}`}
                        className="rounded-xl border border-line bg-ink/50 p-3 transition-colors hover:border-accent/40"
                      >
                        <p className="label mb-2">{item.label}</p>
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={item.entry.player.photo_url}
                            name={item.entry.player.ign}
                            role={item.entry.player.primary_role}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-fg">
                              {item.entry.player.ign}
                            </p>
                            <p className="num text-xl text-accent">{item.stat(item.entry)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ----------------------------------- schedule / board / activity --- */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Upcoming */}
        <Card>
          <CardHeader
            title="Coming up"
            icon={CalendarDays}
            action={
              <Link to="/schedule" className="text-xs text-accent hover:underline">
                All
              </Link>
            }
          />
          {!upcoming.length && !liveTournaments.length ? (
            <p className="py-6 text-center text-sm text-faint">Nothing scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-line bg-ink/50 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-fg">
                      {event.title}
                    </p>
                    <EventTypeBadge type={event.event_type} size="sm" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {dateShort(event.starts_at)} · {timeOnly(event.starts_at)}
                  </p>
                </div>
              ))}

              {liveTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="block rounded-lg border border-accent/30 bg-accent/5 p-2.5 transition-colors hover:border-accent/60"
                >
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="shrink-0 text-accent" />
                    <p className="min-w-0 truncate text-sm font-medium text-fg">
                      {tournament.name}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {dateShort(tournament.start_date)} — {dateShort(tournament.end_date)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader
            title="Announcements"
            icon={Megaphone}
            action={
              <Link to="/notes" className="text-xs text-accent hover:underline">
                All
              </Link>
            }
          />
          {!board.length ? (
            <p className="py-6 text-center text-sm text-faint">No announcements.</p>
          ) : (
            <div className="space-y-2">
              {board.map((item) => (
                <div
                  key={item.id}
                  className={
                    'rounded-lg border p-2.5 ' +
                    (item.is_pinned
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-line bg-ink/50')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-fg">{item.title}</p>
                    {item.is_pinned && (
                      <Badge color="#f59e0b" size="sm">
                        Pinned
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[10px] text-faint">{timeAgo(item.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader title="Recent activity" icon={Activity} />
          {!activity.length ? (
            <p className="py-6 text-center text-sm text-faint">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {activity.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 border-b border-line/60 pb-1.5 text-xs last:border-0"
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        entry.action === 'delete'
                          ? '#ef4444'
                          : entry.action === 'insert'
                            ? '#22c55e'
                            : '#38bdf8',
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-muted">{entry.summary}</p>
                    <p className="text-[10px] text-faint">{dateTime(entry.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
