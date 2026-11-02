/**
 * One map in detail:
 *   • our overall record on it
 *   • which players perform best there (map-wise leaderboard)
 *   • how each drop spot has gone
 *   • our placement trend on this map
 */
import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Map as MapIcon, Users, Crosshair } from 'lucide-react'
import { useData } from '@/context/DataContext'
import {
  aggregateTeam,
  deriveTeam,
  buildLeaderboard,
  teamByDropSpot,
  teamTrend,
} from '@/lib/stats'
import { num, pct, dateShort } from '@/lib/format'

import { Button, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/Primitives'
import { StatBox, StatGrid } from '@/components/ui/StatBox'
import { DataTable } from '@/components/ui/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { PlacementChip, RankMedal } from '@/components/ui/Chips'
import { PlacementTrend, BarCompare, SERIES } from '@/components/ui/Charts'

export default function MapDetail() {
  const { mapId } = useParams()
  const { maps, matches, players, dropSpots, statsIndex, settings, spotName } = useData()

  const map = maps.find((m) => m.id === mapId)

  const mapMatches = useMemo(
    () => matches.filter((m) => m.map_id === mapId),
    [matches, mapId],
  )

  const totals = useMemo(() => deriveTeam(aggregateTeam(mapMatches)), [mapMatches])

  const leaderboard = useMemo(
    () => buildLeaderboard(players, mapMatches, statsIndex, settings.rating_weights),
    [players, mapMatches, statsIndex, settings.rating_weights],
  )

  const spots = useMemo(
    () => teamByDropSpot(mapMatches, dropSpots.filter((s) => s.map_id === mapId), maps),
    [mapMatches, dropSpots, mapId, maps],
  )

  const trend = useMemo(() => teamTrend(mapMatches, 20), [mapMatches])

  if (!map) {
    return (
      <EmptyState
        icon={MapIcon}
        title="Map not found"
        action={
          <Link to="/maps">
            <Button>Back to maps</Button>
          </Link>
        }
      />
    )
  }

  const playerColumns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      sortable: false,
      render: (row) => <RankMedal rank={leaderboard.indexOf(row) + 1} size="sm" />,
    },
    {
      key: 'player',
      label: 'Player',
      value: (r) => r.player.ign,
      render: (r) => (
        <Link
          to={`/players/${r.player.id}`}
          className="flex items-center gap-2 hover:text-accent"
        >
          <Avatar src={r.player.photo_url} name={r.player.ign} role={r.player.primary_role} size="xs" />
          <span className="whitespace-nowrap font-medium">{r.player.ign}</span>
        </Link>
      ),
    },
    { key: 'matches', label: 'Matches', align: 'right' },
    { key: 'finishes', label: 'Kills', align: 'right' },
    { key: 'kd', label: 'K/D', align: 'right', render: (r) => r.kd.toFixed(2) },
    { key: 'avgDamage', label: 'Avg dmg', align: 'right', render: (r) => num(r.avgDamage) },
    { key: 'headshotPct', label: 'HS %', align: 'right', render: (r) => pct(r.headshotPct, 1), hideOnMobile: true },
    { key: 'mvps', label: 'MVPs', align: 'right', hideOnMobile: true },
    {
      key: 'rating',
      label: 'Rating',
      align: 'right',
      render: (r) => <span className="font-head font-semibold text-accent">{r.rating}</span>,
    },
  ]

  const spotColumns = [
    { key: 'spot', label: 'Drop spot', value: (r) => r.spot.name, render: (r) => (
      <span className="font-medium text-fg">{r.spot.name}</span>
    ) },
    { key: 'matches', label: 'Landed', align: 'right' },
    { key: 'wwcd', label: 'WWCD', align: 'right' },
    { key: 'avgPlacement', label: 'Avg place', align: 'right', render: (r) => r.avgPlacement.toFixed(2) },
    { key: 'avgFinishes', label: 'Avg kills', align: 'right', render: (r) => r.avgFinishes.toFixed(2) },
    { key: 'avgPoints', label: 'Avg points', align: 'right', render: (r) => (
      <span className="font-head font-semibold text-accent">{r.avgPoints.toFixed(2)}</span>
    ) },
    { key: 'contestedRate', label: 'Contested', align: 'right', render: (r) => pct(r.contestedRate, 0) },
    {
      key: 'earlySurvivalRate',
      label: 'Past early game',
      align: 'right',
      render: (r) => pct(r.earlySurvivalRate, 0),
      hideOnMobile: true,
    },
  ]

  const historyColumns = [
    {
      key: 'played_at',
      label: 'Date',
      value: (m) => new Date(m.played_at).getTime(),
      render: (m) => (
        <Link to={`/matches/${m.id}`} className="text-muted hover:text-accent">
          {dateShort(m.played_at)}
        </Link>
      ),
    },
    {
      key: 'placement',
      label: 'Place',
      align: 'center',
      render: (m) => <PlacementChip placement={m.placement} size="sm" />,
    },
    {
      key: 'spot',
      label: 'Drop',
      value: (m) => (m.drop_spot_id ? spotName(m.drop_spot_id) : ''),
      render: (m) => (m.drop_spot_id ? spotName(m.drop_spot_id) : '—'),
    },
    { key: 'team_finishes', label: 'Finishes', align: 'right' },
    { key: 'team_damage', label: 'Damage', align: 'right', render: (m) => num(m.team_damage), hideOnMobile: true },
    { key: 'total_points', label: 'Points', align: 'right', render: (m) => (
      <span className="num text-lg text-accent">{m.total_points}</span>
    ) },
  ]

  return (
    <>
      <Link
        to="/maps"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} /> All maps
      </Link>

      <PageHeader title={map.name} subtitle={`${totals.matches} matches played on this map`} />

      {!mapMatches.length ? (
        <EmptyState
          icon={MapIcon}
          title={`No matches on ${map.name} yet`}
          message="Log a match on this map and its breakdown appears here."
        />
      ) : (
        <>
          <StatGrid cols={6} className="mb-4">
            <StatBox label="Matches" value={totals.matches} />
            <StatBox label="Chicken Dinners" value={totals.wwcd} color="#f59e0b" />
            <StatBox label="Win rate" value={totals.winRate} decimals={1} suffix="%" />
            <StatBox label="Avg placement" value={totals.avgPlacement} decimals={2} />
            <StatBox label="Avg finishes" value={totals.avgFinishes} decimals={2} />
            <StatBox label="Avg points" value={totals.avgPoints} decimals={2} color="var(--color-accent)" />
          </StatGrid>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <PlacementTrend
              title={`Placement trend on ${map.name}`}
              subtitle="Lower is better — the dashed line is the top 5 cut"
              data={trend}
              maxTeams={Math.max(16, ...mapMatches.map((m) => m.teams_in_lobby || 16))}
            />
            <BarCompare
              title="Average points by drop spot"
              data={spots.map((s) => ({ name: s.spot.name, value: s.avgPoints }))}
              dataKey="value"
              label="Avg points"
              decimals={1}
              horizontal
              height={Math.max(240, spots.length * 34)}
              color={SERIES[1]}
            />
          </div>

          <Card className="mb-4">
            <CardHeader
              title={`Who performs best on ${map.name}`}
              subtitle="Map-wise player leaderboard"
              icon={Users}
            />
            <DataTable
              columns={playerColumns}
              rows={leaderboard}
              initialSort={{ key: 'rating', dir: 'desc' }}
              pageSize={0}
              rowKey={(r) => r.player.id}
              dense
            />
          </Card>

          <Card className="mb-4">
            <CardHeader title="Results by drop spot" icon={Crosshair} />
            <DataTable
              columns={spotColumns}
              rows={spots}
              initialSort={{ key: 'avgPoints', dir: 'desc' }}
              pageSize={0}
              rowKey={(r) => r.spot.id}
              dense
              empty={
                <p className="py-8 text-center text-sm text-faint">
                  No drop spots recorded on this map yet.
                </p>
              }
            />
          </Card>

          <Card>
            <CardHeader title={`Every match on ${map.name}`} />
            <DataTable
              columns={historyColumns}
              rows={mapMatches}
              initialSort={{ key: 'played_at', dir: 'desc' }}
              pageSize={15}
              dense
            />
          </Card>
        </>
      )}
    </>
  )
}
