/**
 * Maps — one card per map showing how the team performs there, plus a
 * best-map / weakest-map call-out.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Map as MapIcon, TrendingUp, TrendingDown, Trophy } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { teamByMap } from '@/lib/stats'
import { num, pct } from '@/lib/format'

import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui/Primitives'
import { MiniStat } from '@/components/ui/StatBox'
import { BarCompare, SERIES } from '@/components/ui/Charts'
import { DataTable } from '@/components/ui/DataTable'

export default function Maps() {
  const { matches, maps } = useData()

  const rows = useMemo(() => teamByMap(matches, maps), [matches, maps])

  /** Best and weakest map, judged by average points per match. */
  const { best, weakest } = useMemo(() => {
    const ranked = [...rows].filter((r) => r.matches >= 2).sort((a, b) => b.avgPoints - a.avgPoints)
    return {
      best: ranked[0] || null,
      weakest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    }
  }, [rows])

  const maxAvgPoints = Math.max(1, ...rows.map((r) => r.avgPoints))

  const columns = [
    {
      key: 'map',
      label: 'Map',
      value: (r) => r.map.name,
      render: (r) => (
        <Link to={`/maps/${r.map.id}`} className="font-medium text-fg hover:text-accent">
          {r.map.name}
        </Link>
      ),
    },
    { key: 'matches', label: 'Matches', align: 'right' },
    { key: 'wwcd', label: 'WWCD', align: 'right' },
    { key: 'winRate', label: 'Win %', align: 'right', render: (r) => pct(r.winRate, 1) },
    { key: 'avgPlacement', label: 'Avg place', align: 'right', render: (r) => r.avgPlacement.toFixed(2) },
    { key: 'finishes', label: 'Finishes', align: 'right' },
    { key: 'avgFinishes', label: 'Avg kills', align: 'right', render: (r) => r.avgFinishes.toFixed(2) },
    { key: 'avgDamage', label: 'Avg damage', align: 'right', render: (r) => num(r.avgDamage), hideOnMobile: true },
    {
      key: 'avgPoints',
      label: 'Avg points',
      align: 'right',
      render: (r) => <span className="font-head font-semibold text-accent">{r.avgPoints.toFixed(2)}</span>,
    },
    { key: 'top5Rate', label: 'Top 5 %', align: 'right', render: (r) => pct(r.top5Rate, 1), hideOnMobile: true },
  ]

  if (!rows.length) {
    return (
      <>
        <PageHeader title="Maps" />
        <EmptyState
          icon={MapIcon}
          title="No map data yet"
          message="Log a few matches and this page will show which maps you win on."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Maps" subtitle="Where we win, and where we need work" />

      {/* Best / weakest */}
      {(best || weakest) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {best && (
            <Card className="border-win/40 bg-win/5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-win">
                <TrendingUp size={14} /> Strongest map
              </p>
              <p className="font-display text-4xl font-semibold uppercase text-fg">
                {best.map.name}
              </p>
              <p className="text-sm text-muted">
                {best.avgPoints.toFixed(2)} avg points · {pct(best.winRate, 0)} win rate ·{' '}
                {best.matches} matches
              </p>
            </Card>
          )}
          {weakest && (
            <Card className="border-bad/40 bg-bad/5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-bad">
                <TrendingDown size={14} /> Weakest map
              </p>
              <p className="font-display text-4xl font-semibold uppercase text-fg">
                {weakest.map.name}
              </p>
              <p className="text-sm text-muted">
                {weakest.avgPoints.toFixed(2)} avg points · {pct(weakest.winRate, 0)} win rate ·{' '}
                {weakest.matches} matches
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Map cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, i) => (
          <Link key={row.map.id} to={`/maps/${row.map.id}`}>
            <Card
              hover
              className="h-full animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-3xl leading-none font-semibold uppercase text-fg">
                    {row.map.name}
                  </h3>
                  <p className="text-xs text-muted">{row.matches} matches played</p>
                </div>
                {row.wwcd > 0 && (
                  <div className="flex items-center gap-1 text-accent">
                    <Trophy size={15} />
                    <span className="num text-xl">{row.wwcd}</span>
                  </div>
                )}
              </div>

              <div className="mb-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="label">Avg points</span>
                  <span className="num text-xl text-accent">{row.avgPoints.toFixed(1)}</span>
                </div>
                <ProgressBar value={row.avgPoints} max={maxAvgPoints} />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <MiniStat label="Win %" value={pct(row.winRate, 0)} />
                <MiniStat label="Top 5" value={pct(row.top5Rate, 0)} />
                <MiniStat label="Avg place" value={row.avgPlacement.toFixed(1)} />
                <MiniStat label="Avg kills" value={row.avgFinishes.toFixed(1)} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <BarCompare
          title="Average points by map"
          data={rows.map((r) => ({ name: r.map.name, value: r.avgPoints }))}
          dataKey="value"
          label="Avg points"
          decimals={1}
        />
        <BarCompare
          title="Win rate by map"
          data={rows.map((r) => ({ name: r.map.name, value: Number(r.winRate.toFixed(1)) }))}
          dataKey="value"
          label="Win rate %"
          decimals={1}
          color={SERIES[2]}
        />
      </div>

      {/* Full table */}
      <Card>
        <CardHeader title="All maps" icon={MapIcon} />
        <DataTable
          columns={columns}
          rows={rows}
          initialSort={{ key: 'avgPoints', dir: 'desc' }}
          pageSize={0}
          rowKey={(r) => r.map.id}
          dense
        />
      </Card>
    </>
  )
}
