/**
 * Match log — every match we have played, with filters, search and sorting.
 * Click any row to open the full match detail page.
 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Swords, Filter, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { filterMatches, aggregateTeam, deriveTeam } from '@/lib/stats'
import { MATCH_TYPE_OPTIONS, DATE_RANGES } from '@/lib/constants'
import { dateTime, num } from '@/lib/format'

import { Button, Card, EmptyState, PageHeader } from '@/components/ui/Primitives'
import { Input, Select } from '@/components/ui/Form'
import { DataTable } from '@/components/ui/DataTable'
import { PlacementChip, MatchTypeBadge } from '@/components/ui/Chips'
import { StatBox, StatGrid } from '@/components/ui/StatBox'
import MatchForm from '@/components/matches/MatchForm'

const PLACEMENT_FILTERS = [
  { value: 'all', label: 'Any placement' },
  { value: 'wwcd', label: 'Chicken Dinners' },
  { value: 'top5', label: 'Top 5' },
  { value: 'top10', label: 'Top 10' },
  { value: 'below10', label: '11th and below' },
]

export default function Matches() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { matches, maps, tournaments, mapName, spotName, statsIndex } = useData()
  const [params, setParams] = useSearchParams()

  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    mapId: 'all',
    matchType: 'all',
    tournamentId: 'all',
    placement: 'all',
    days: null,
  })

  // "/matches?new=1" from the top bar opens the form straight away
  useEffect(() => {
    if (params.get('new')) {
      setShowForm(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const filtered = useMemo(
    () => filterMatches(matches, filters, statsIndex),
    [matches, filters, statsIndex],
  )

  const summary = useMemo(() => deriveTeam(aggregateTeam(filtered)), [filtered])

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && value !== 'all' && !(key === 'search' && !value),
  ).length

  const clearFilters = () =>
    setFilters({
      search: '',
      mapId: 'all',
      matchType: 'all',
      tournamentId: 'all',
      placement: 'all',
      days: null,
    })

  const columns = [
    {
      key: 'played_at',
      label: 'Date',
      value: (m) => new Date(m.played_at).getTime(),
      render: (m) => (
        <span className="whitespace-nowrap text-muted">{dateTime(m.played_at)}</span>
      ),
    },
    {
      key: 'placement',
      label: 'Place',
      align: 'center',
      render: (m) => <PlacementChip placement={m.placement} size="sm" />,
    },
    {
      key: 'map',
      label: 'Map',
      value: (m) => mapName(m.map_id),
      render: (m) => <span className="text-fg">{mapName(m.map_id)}</span>,
    },
    {
      key: 'drop',
      label: 'Drop spot',
      value: (m) => (m.drop_spot_id ? spotName(m.drop_spot_id) : ''),
      render: (m) => (
        <span className="text-muted">{m.drop_spot_id ? spotName(m.drop_spot_id) : '—'}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'match_type',
      label: 'Type',
      render: (m) => <MatchTypeBadge type={m.match_type} size="sm" />,
      hideOnMobile: true,
    },
    {
      key: 'event',
      label: 'Event',
      value: (m) =>
        tournaments.find((t) => t.id === m.tournament_id)?.name || m.scrim_name || '',
      render: (m) => {
        const name =
          tournaments.find((t) => t.id === m.tournament_id)?.name || m.scrim_name
        return (
          <span className="block max-w-[200px] truncate text-muted">
            {name || '—'}
            {m.match_number ? ` · M${m.match_number}` : ''}
          </span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: 'team_finishes',
      label: 'Finishes',
      align: 'right',
      render: (m) => <span className="font-head font-semibold">{m.team_finishes}</span>,
    },
    {
      key: 'team_damage',
      label: 'Damage',
      align: 'right',
      render: (m) => <span className="text-muted">{num(m.team_damage)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'total_points',
      label: 'Points',
      align: 'right',
      render: (m) => (
        <span className="num text-lg text-accent">{m.total_points}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Matches"
        subtitle={`${filtered.length} of ${matches.length} matches shown`}
      >
        <Button
          variant={activeFilters ? 'outline' : 'secondary'}
          onClick={() => setShowFilters((s) => !s)}
        >
          <Filter size={15} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        {can.editMatches && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add match
          </Button>
        )}
      </PageHeader>

      {/* Summary of whatever is currently filtered */}
      {filtered.length > 0 && (
        <StatGrid cols={5} className="mb-4">
          <StatBox label="Matches" value={summary.matches} />
          <StatBox label="Chicken Dinners" value={summary.wwcd} color="#f59e0b" />
          <StatBox label="Win rate" value={summary.winRate} decimals={1} suffix="%" />
          <StatBox label="Total finishes" value={summary.finishes} />
          <StatBox label="Avg points" value={summary.avgPoints} decimals={1} />
        </StatGrid>
      )}

      {/* Filter bar */}
      {showFilters && (
        <Card className="mb-4 animate-[fade-up_0.25s_ease-out]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Input
              label="Search"
              placeholder="Notes, opponent, stage…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
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
              onChange={(e) =>
                setFilters((f) => ({ ...f, tournamentId: e.target.value }))
              }
            />
            <Select
              label="Placement"
              options={PLACEMENT_FILTERS}
              value={filters.placement}
              onChange={(e) => setFilters((f) => ({ ...f, placement: e.target.value }))}
            />
            <Select
              label="Period"
              options={DATE_RANGES.map((r) => ({
                value: r.days ?? 'all',
                label: r.label,
              }))}
              value={filters.days ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  days: e.target.value === 'all' ? null : Number(e.target.value),
                }))
              }
            />
          </div>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <X size={12} /> Clear all filters
            </button>
          )}
        </Card>
      )}

      {/* The table */}
      <DataTable
        columns={columns}
        rows={filtered}
        initialSort={{ key: 'played_at', dir: 'desc' }}
        pageSize={25}
        onRowClick={(m) => navigate(`/matches/${m.id}`)}
        empty={
          <EmptyState
            icon={Swords}
            title={matches.length ? 'No matches match those filters' : 'No matches yet'}
            message={
              matches.length
                ? 'Try widening the date range or clearing a filter.'
                : 'Add your first match and the dashboard, maps and leaderboard will fill in automatically.'
            }
            action={
              matches.length ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                can.editMatches && (
                  <Button onClick={() => setShowForm(true)}>
                    <Plus size={15} /> Add your first match
                  </Button>
                )
              )
            }
          />
        }
      />

      {showForm && <MatchForm open onClose={() => setShowForm(false)} />}
    </>
  )
}
