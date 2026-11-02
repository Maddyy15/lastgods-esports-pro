/**
 * Leaderboard — rank the squad by any stat, filtered by map, match type,
 * tournament or date range.
 *
 * The top three get the podium treatment; everyone else is in the table.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListOrdered, Trophy } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { buildLeaderboard, filterMatches, LEADERBOARD_METRICS } from '@/lib/stats'
import { num, pct, duration } from '@/lib/format'
import { MATCH_TYPE_OPTIONS, DATE_RANGES } from '@/lib/constants'

import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/Primitives'
import { Select } from '@/components/ui/Form'
import { DataTable } from '@/components/ui/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { RankMedal, RoleBadges } from '@/components/ui/Chips'
import { BarCompare } from '@/components/ui/Charts'

/** Formats a value the way its metric expects. */
function formatMetric(value, format) {
  switch (format) {
    case 'dec':
      return Number(value).toFixed(2)
    case 'pct':
      return pct(value, 1)
    case 'time':
      return duration(value)
    default:
      return num(value)
  }
}

export default function Leaderboard() {
  const { players, matches, maps, tournaments, statsIndex, settings } = useData()

  const [metric, setMetric] = useState('finishes')
  const [filters, setFilters] = useState({
    mapId: 'all',
    matchType: 'all',
    tournamentId: 'all',
    days: null,
  })

  const metricMeta = LEADERBOARD_METRICS.find((m) => m.value === metric)

  const filtered = useMemo(
    () => filterMatches(matches, filters, statsIndex),
    [matches, filters, statsIndex],
  )

  const board = useMemo(() => {
    const rows = buildLeaderboard(players, filtered, statsIndex, settings.rating_weights)
    return rows.sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
  }, [players, filtered, statsIndex, settings.rating_weights, metric])

  const podium = board.slice(0, 3)

  const columns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      sortable: false,
      width: 56,
      render: (row) => <RankMedal rank={board.indexOf(row) + 1} size="sm" />,
    },
    {
      key: 'player',
      label: 'Player',
      value: (r) => r.player.ign,
      render: (r) => (
        <Link to={`/players/${r.player.id}`} className="flex items-center gap-2 hover:text-accent">
          <Avatar src={r.player.photo_url} name={r.player.ign} role={r.player.primary_role} size="xs" />
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium">{r.player.ign}</p>
            <RoleBadges primary={r.player.primary_role} size="sm" />
          </div>
        </Link>
      ),
    },
    { key: 'matches', label: 'Matches', align: 'right' },
    { key: 'finishes', label: 'Finishes', align: 'right' },
    { key: 'knocks', label: 'Knocks', align: 'right', hideOnMobile: true },
    { key: 'assists', label: 'Assists', align: 'right', hideOnMobile: true },
    { key: 'damage', label: 'Damage', align: 'right', render: (r) => num(r.damage) },
    { key: 'kd', label: 'K/D', align: 'right', render: (r) => r.kd.toFixed(2) },
    { key: 'avgDamage', label: 'Avg dmg', align: 'right', render: (r) => num(r.avgDamage) },
    {
      key: 'headshotPct',
      label: 'HS %',
      align: 'right',
      render: (r) => pct(r.headshotPct, 1),
      hideOnMobile: true,
    },
    { key: 'revives', label: 'Revives', align: 'right', hideOnMobile: true },
    { key: 'mvps', label: 'MVPs', align: 'right' },
    {
      key: 'survival_seconds',
      label: 'Survival',
      align: 'right',
      render: (r) => duration(r.survival_seconds),
      hideOnMobile: true,
    },
    {
      key: 'rating',
      label: 'Rating',
      align: 'right',
      render: (r) => <span className="num text-lg text-accent">{r.rating}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle={`Ranked by ${metricMeta?.label} across ${filtered.length} matches`}
      />

      {/* Filters */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Rank by"
            options={LEADERBOARD_METRICS}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          />
          <Select
            label="Map"
            options={[
              { value: 'all', label: 'All maps' },
              ...maps.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={filters.mapId}
            onChange={(e) => setFilters((f) => ({ ...f, mapId: e.target.value }))}
          />
          <Select
            label="Match type"
            options={[{ value: 'all', label: 'All types' }, ...MATCH_TYPE_OPTIONS]}
            value={filters.matchType}
            onChange={(e) => setFilters((f) => ({ ...f, matchType: e.target.value }))}
          />
          <Select
            label="Tournament"
            options={[
              { value: 'all', label: 'All events' },
              ...tournaments.map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={filters.tournamentId}
            onChange={(e) => setFilters((f) => ({ ...f, tournamentId: e.target.value }))}
          />
          <Select
            label="Period"
            options={DATE_RANGES.map((r) => ({ value: r.days ?? 'all', label: r.label }))}
            value={filters.days ?? 'all'}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                days: e.target.value === 'all' ? null : Number(e.target.value),
              }))
            }
          />
        </div>
      </Card>

      {!board.length ? (
        <EmptyState
          icon={ListOrdered}
          title="Nothing to rank yet"
          message="No matches match these filters. Try widening the date range."
        />
      ) : (
        <>
          {/* Podium */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {podium.map((row, i) => {
              const colors = ['#f5c518', '#c7ccd6', '#cd7f32']
              return (
                <Link key={row.player.id} to={`/players/${row.player.id}`}>
                  <Card
                    hover
                    className="h-full text-center animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{
                      animationDelay: `${i * 70}ms`,
                      borderColor: `${colors[i]}66`,
                      boxShadow: `0 0 36px -22px ${colors[i]}`,
                    }}
                  >
                    <div className="mb-2 flex justify-center">
                      <RankMedal rank={i + 1} size="lg" />
                    </div>
                    <div className="mb-2 flex justify-center">
                      <Avatar
                        src={row.player.photo_url}
                        name={row.player.ign}
                        role={row.player.primary_role}
                        size="lg"
                      />
                    </div>
                    <p className="font-head text-lg font-semibold text-fg">{row.player.ign}</p>
                    <p className="text-xs text-muted">{row.player.real_name}</p>
                    <p className="num mt-2 text-4xl" style={{ color: colors[i] }}>
                      {formatMetric(row[metric], metricMeta?.format)}
                    </p>
                    <p className="label">{metricMeta?.label}</p>
                    <p className="mt-2 text-[11px] text-faint">
                      {row.matches} matches · rating {row.rating}
                    </p>
                  </Card>
                </Link>
              )
            })}
          </div>

          <BarCompare
            className="mb-4"
            title={`${metricMeta?.label} — whole squad`}
            data={board.map((r) => ({
              name: r.player.ign,
              value: Number(Number(r[metric] || 0).toFixed(2)),
            }))}
            dataKey="value"
            label={metricMeta?.label}
            decimals={metricMeta?.format === 'dec' || metricMeta?.format === 'pct' ? 2 : 0}
            horizontal
            height={Math.max(220, board.length * 38)}
          />

          <Card>
            <CardHeader title="Full standings" icon={Trophy} />
            <DataTable
              columns={columns}
              rows={board}
              initialSort={{ key: metric, dir: 'desc' }}
              pageSize={0}
              rowKey={(r) => r.player.id}
              dense
            />
          </Card>
        </>
      )}
    </>
  )
}
