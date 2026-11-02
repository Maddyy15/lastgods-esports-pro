/**
 * Drop Spot Analysis — the page that answers "where should we land?".
 *
 * For every spot we have actually used: how often we landed there, how often
 * it was contested, how often we survived the early game, and what it has
 * been worth in points.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, Swords, ShieldCheck } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { teamByDropSpot } from '@/lib/stats'
import { num, pct } from '@/lib/format'

import { Card, CardHeader, EmptyState, PageHeader, Tabs, Badge } from '@/components/ui/Primitives'
import { StatBox, StatGrid, MiniStat } from '@/components/ui/StatBox'
import { DataTable } from '@/components/ui/DataTable'
import { BarCompare, SERIES } from '@/components/ui/Charts'

export default function DropSpots() {
  const { matches, dropSpots, maps } = useData()
  const [mapFilter, setMapFilter] = useState('all')

  const allRows = useMemo(
    () => teamByDropSpot(matches, dropSpots, maps),
    [matches, dropSpots, maps],
  )

  const rows = useMemo(
    () => (mapFilter === 'all' ? allRows : allRows.filter((r) => r.spot.map_id === mapFilter)),
    [allRows, mapFilter],
  )

  /** The spot we should be landing at, and the one to stop using. */
  const { bestSpot, worstSpot } = useMemo(() => {
    const ranked = [...rows].filter((r) => r.matches >= 2).sort((a, b) => b.avgPoints - a.avgPoints)
    return {
      bestSpot: ranked[0] || null,
      worstSpot: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    }
  }, [rows])

  const tabs = [
    { value: 'all', label: 'All maps', count: allRows.length },
    ...maps
      .map((m) => ({
        value: m.id,
        label: m.name,
        count: allRows.filter((r) => r.spot.map_id === m.id).length,
      }))
      .filter((t) => t.count > 0),
  ]

  const columns = [
    {
      key: 'spot',
      label: 'Drop spot',
      value: (r) => r.spot.name,
      render: (r) => <span className="font-medium text-fg">{r.spot.name}</span>,
    },
    {
      key: 'map',
      label: 'Map',
      value: (r) => r.mapName,
      render: (r) => (
        <Link to={`/maps/${r.spot.map_id}`} className="text-muted hover:text-accent">
          {r.mapName}
        </Link>
      ),
    },
    { key: 'matches', label: 'Landed', align: 'right' },
    { key: 'wwcd', label: 'WWCD', align: 'right' },
    {
      key: 'avgPlacement',
      label: 'Avg place',
      align: 'right',
      render: (r) => r.avgPlacement.toFixed(2),
    },
    {
      key: 'avgFinishes',
      label: 'Avg kills',
      align: 'right',
      render: (r) => r.avgFinishes.toFixed(2),
    },
    {
      key: 'avgPoints',
      label: 'Avg points',
      align: 'right',
      render: (r) => (
        <span className="font-head font-semibold text-accent">{r.avgPoints.toFixed(2)}</span>
      ),
    },
    {
      key: 'contestedRate',
      label: 'Contested',
      align: 'right',
      render: (r) => (
        <span className={r.contestedRate > 50 ? 'text-warn' : 'text-muted'}>
          {pct(r.contestedRate, 0)}
        </span>
      ),
    },
    {
      key: 'earlySurvivalRate',
      label: 'Past early game',
      align: 'right',
      render: (r) => (
        <span className={r.earlySurvivalRate < 50 ? 'text-bad' : 'text-win'}>
          {pct(r.earlySurvivalRate, 0)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'damage',
      label: 'Avg damage',
      align: 'right',
      value: (r) => r.avgDamage,
      render: (r) => num(r.avgDamage),
      hideOnMobile: true,
    },
  ]

  if (!allRows.length) {
    return (
      <>
        <PageHeader title="Drop Spot Analysis" />
        <EmptyState
          icon={Crosshair}
          title="No drop spots used yet"
          message="Pick a drop spot when you log a match, and this page will start telling you which landings actually pay off."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Drop Spot Analysis"
        subtitle="Which landings are actually worth it"
      />

      <Tabs tabs={tabs} value={mapFilter} onChange={setMapFilter} className="mb-4" />

      {/* Call-outs */}
      {(bestSpot || worstSpot) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {bestSpot && (
            <Card className="border-win/40 bg-win/5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-win">
                <ShieldCheck size={14} /> Our most profitable drop
              </p>
              <p className="font-display text-3xl font-semibold uppercase text-fg">
                {bestSpot.spot.name}
              </p>
              <p className="mb-2 text-xs text-muted">{bestSpot.mapName}</p>
              <div className="grid grid-cols-4 gap-1.5">
                <MiniStat label="Landed" value={bestSpot.matches} />
                <MiniStat label="Avg pts" value={bestSpot.avgPoints.toFixed(1)} />
                <MiniStat label="Avg place" value={bestSpot.avgPlacement.toFixed(1)} />
                <MiniStat label="Contested" value={pct(bestSpot.contestedRate, 0)} />
              </div>
            </Card>
          )}
          {worstSpot && (
            <Card className="border-bad/40 bg-bad/5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-bad">
                <Swords size={14} /> Costing us the most
              </p>
              <p className="font-display text-3xl font-semibold uppercase text-fg">
                {worstSpot.spot.name}
              </p>
              <p className="mb-2 text-xs text-muted">{worstSpot.mapName}</p>
              <div className="grid grid-cols-4 gap-1.5">
                <MiniStat label="Landed" value={worstSpot.matches} />
                <MiniStat label="Avg pts" value={worstSpot.avgPoints.toFixed(1)} />
                <MiniStat label="Avg place" value={worstSpot.avgPlacement.toFixed(1)} />
                <MiniStat label="Contested" value={pct(worstSpot.contestedRate, 0)} />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Summary */}
      <StatGrid cols={4} className="mb-4">
        <StatBox label="Spots used" value={rows.length} />
        <StatBox
          label="Most landed"
          value={rows.length ? [...rows].sort((a, b) => b.matches - a.matches)[0].spot.name : '—'}
          animate={false}
          size="sm"
        />
        <StatBox
          label="Avg contested rate"
          value={rows.length ? rows.reduce((a, r) => a + r.contestedRate, 0) / rows.length : 0}
          decimals={0}
          suffix="%"
        />
        <StatBox
          label="Avg early survival"
          value={
            rows.length ? rows.reduce((a, r) => a + r.earlySurvivalRate, 0) / rows.length : 0
          }
          decimals={0}
          suffix="%"
        />
      </StatGrid>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <BarCompare
          title="Average points by drop spot"
          data={[...rows]
            .sort((a, b) => b.avgPoints - a.avgPoints)
            .slice(0, 12)
            .map((r) => ({ name: r.spot.name, value: r.avgPoints }))}
          dataKey="value"
          label="Avg points"
          decimals={1}
          horizontal
          height={Math.max(260, Math.min(rows.length, 12) * 32)}
        />
        <BarCompare
          title="How often each drop is contested"
          data={[...rows]
            .sort((a, b) => b.contestedRate - a.contestedRate)
            .slice(0, 12)
            .map((r) => ({ name: r.spot.name, value: Number(r.contestedRate.toFixed(0)) }))}
          dataKey="value"
          label="Contested %"
          horizontal
          height={Math.max(260, Math.min(rows.length, 12) * 32)}
          color={SERIES[4]}
        />
      </div>

      <Card>
        <CardHeader
          title="Every drop spot we have used"
          icon={Crosshair}
          action={<Badge color="#8d95a6">{rows.length} spots</Badge>}
        />
        <DataTable
          columns={columns}
          rows={rows}
          initialSort={{ key: 'avgPoints', dir: 'desc' }}
          pageSize={25}
          rowKey={(r) => r.spot.id}
          dense
        />
      </Card>
    </>
  )
}
