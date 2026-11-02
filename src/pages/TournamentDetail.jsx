/**
 * One tournament: all our matches in it, points per day, stage progression,
 * the best performer, and an editable standings table for the other teams.
 */
import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Trophy, Plus, Trash2, Save, Users, CalendarDays } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { saveRow, deleteRow } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { aggregateTeam, deriveTeam, buildLeaderboard } from '@/lib/stats'
import { num, dateShort, rupees, ordinal, pct } from '@/lib/format'

import { Button, Card, CardHeader, EmptyState, PageHeader, Badge } from '@/components/ui/Primitives'
import { Modal, useConfirm } from '@/components/ui/Modal'
import { Input, FormGrid } from '@/components/ui/Form'
import { StatBox, StatGrid, InfoRow } from '@/components/ui/StatBox'
import { DataTable } from '@/components/ui/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { PlacementChip, TournamentStatusBadge, RankMedal } from '@/components/ui/Chips'
import { TrendLine, BarCompare, SERIES } from '@/components/ui/Charts'

/* ---------------------------------------------------------------------------
 * Add a rival team's points to the standings
 * ------------------------------------------------------------------------- */
function StandingForm({ open, onClose, tournamentId, row }) {
  const { reload } = useData()
  const [form, setForm] = useState(
    () =>
      row || {
        team_name: '',
        placement_pts: 0,
        finish_pts: 0,
        matches_played: 0,
        wwcd: 0,
        is_us: false,
      },
  )
  const [busy, setBusy] = useState(false)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveRow('tournament_standings', {
        ...form,
        tournament_id: tournamentId,
        placement_pts: Number(form.placement_pts) || 0,
        finish_pts: Number(form.finish_pts) || 0,
        matches_played: Number(form.matches_played) || 0,
        wwcd: Number(form.wwcd) || 0,
      })
      await reload()
      toast.success('Standings updated')
      onClose()
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Edit team points' : 'Add a team to the standings'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="standing-form" loading={busy}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="standing-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Team name" required value={form.team_name} onChange={setField('team_name')} />
        <FormGrid>
          <Input
            label="Placement points"
            type="number"
            value={form.placement_pts}
            onChange={setField('placement_pts')}
          />
          <Input
            label="Finish points"
            type="number"
            value={form.finish_pts}
            onChange={setField('finish_pts')}
          />
          <Input
            label="Matches played"
            type="number"
            value={form.matches_played}
            onChange={setField('matches_played')}
          />
          <Input label="Chicken Dinners" type="number" value={form.wwcd} onChange={setField('wwcd')} />
        </FormGrid>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------------------- */
export default function TournamentDetail() {
  const { tournamentId } = useParams()
  const { can } = useAuth()
  const {
    tournaments,
    matches,
    players,
    standings,
    statsIndex,
    settings,
    mapName,
    spotName,
    reload,
  } = useData()
  const confirm = useConfirm()
  const [editingStanding, setEditingStanding] = useState(null)

  const tournament = tournaments.find((t) => t.id === tournamentId)

  const own = useMemo(
    () => matches.filter((m) => m.tournament_id === tournamentId),
    [matches, tournamentId],
  )

  const totals = useMemo(() => deriveTeam(aggregateTeam(own)), [own])

  /** Points gathered on each day of the event. */
  const byDay = useMemo(() => {
    const days = new Map()
    for (const match of own) {
      const key = match.day_number ?? 1
      if (!days.has(key)) days.set(key, { day: key, points: 0, finishes: 0, matches: 0, wwcd: 0 })
      const row = days.get(key)
      row.points += match.total_points || 0
      row.finishes += match.team_finishes || 0
      row.matches += 1
      if (match.placement === 1) row.wwcd += 1
    }
    return [...days.values()].sort((a, b) => a.day - b.day)
  }, [own])

  /** Points per stage (Qualifiers → Grand Finals). */
  const byStage = useMemo(() => {
    const stages = new Map()
    for (const match of own) {
      const key = match.stage || 'Unlabelled'
      if (!stages.has(key)) stages.set(key, { stage: key, points: 0, matches: 0 })
      const row = stages.get(key)
      row.points += match.total_points || 0
      row.matches += 1
    }
    return [...stages.values()]
  }, [own])

  const board = useMemo(
    () => buildLeaderboard(players, own, statsIndex, settings.rating_weights),
    [players, own, statsIndex, settings.rating_weights],
  )

  const bestPerformer = board.length
    ? [...board].sort((a, b) => b.rating - a.rating)[0]
    : null

  /** Our row is calculated; everyone else's is typed in by the coach. */
  const table = useMemo(() => {
    const others = standings.filter((s) => s.tournament_id === tournamentId && !s.is_us)
    const us = {
      id: 'us',
      team_name: settings.team_name,
      is_us: true,
      placement_pts: own.reduce((a, m) => a + (m.placement_points || 0), 0),
      finish_pts: own.reduce((a, m) => a + (m.finish_points || 0), 0),
      matches_played: own.length,
      wwcd: totals.wwcd,
    }
    us.total_pts = us.placement_pts + us.finish_pts
    return [us, ...others].sort((a, b) => (b.total_pts || 0) - (a.total_pts || 0))
  }, [standings, tournamentId, own, totals.wwcd, settings.team_name])

  const trend = useMemo(
    () =>
      [...own]
        .sort((a, b) => new Date(a.played_at) - new Date(b.played_at))
        .map((m, i) => ({
          label: `M${m.match_number ?? i + 1}`,
          points: m.total_points || 0,
          finishes: m.team_finishes || 0,
          placement: m.placement,
        })),
    [own],
  )

  if (!tournament) {
    return (
      <EmptyState
        icon={Trophy}
        title="Tournament not found"
        action={
          <Link to="/tournaments">
            <Button>Back to tournaments</Button>
          </Link>
        }
      />
    )
  }

  async function removeStanding(row) {
    try {
      await deleteRow('tournament_standings', row.id)
      await reload()
      toast.success('Removed from standings')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  const matchColumns = [
    {
      key: 'match_number',
      label: 'Match',
      render: (m) => (
        <Link to={`/matches/${m.id}`} className="font-medium text-fg hover:text-accent">
          {m.day_number ? `D${m.day_number} ` : ''}M{m.match_number ?? '?'}
        </Link>
      ),
    },
    {
      key: 'placement',
      label: 'Place',
      align: 'center',
      render: (m) => <PlacementChip placement={m.placement} size="sm" />,
    },
    { key: 'map', label: 'Map', value: (m) => mapName(m.map_id), render: (m) => mapName(m.map_id) },
    {
      key: 'spot',
      label: 'Drop',
      value: (m) => (m.drop_spot_id ? spotName(m.drop_spot_id) : ''),
      render: (m) => (m.drop_spot_id ? spotName(m.drop_spot_id) : '—'),
      hideOnMobile: true,
    },
    { key: 'stage', label: 'Stage', render: (m) => m.stage || '—', hideOnMobile: true },
    { key: 'placement_points', label: 'Place pts', align: 'right', hideOnMobile: true },
    { key: 'finish_points', label: 'Finish pts', align: 'right', hideOnMobile: true },
    {
      key: 'total_points',
      label: 'Points',
      align: 'right',
      render: (m) => <span className="num text-lg text-accent">{m.total_points}</span>,
    },
  ]

  const standingColumns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      sortable: false,
      width: 56,
      render: (row) => <RankMedal rank={table.indexOf(row) + 1} size="sm" />,
    },
    {
      key: 'team_name',
      label: 'Team',
      render: (row) => (
        <span className={row.is_us ? 'font-semibold text-accent' : 'text-fg'}>
          {row.team_name}
          {row.is_us && (
            <Badge color="#f59e0b" size="sm" className="ml-2">
              Us
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'matches_played', label: 'Matches', align: 'right' },
    { key: 'wwcd', label: 'WWCD', align: 'right' },
    { key: 'placement_pts', label: 'Place pts', align: 'right' },
    { key: 'finish_pts', label: 'Finish pts', align: 'right' },
    {
      key: 'total_pts',
      label: 'Total',
      align: 'right',
      render: (row) => <span className="num text-lg text-accent">{row.total_pts}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      render: (row) =>
        can.editTournaments && !row.is_us ? (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setEditingStanding(row)}
              className="rounded p-1 text-muted hover:text-accent"
            >
              <Save size={13} />
            </button>
            <button
              onClick={() =>
                confirm.ask({
                  title: `Remove ${row.team_name}?`,
                  message: 'This only removes them from the standings table.',
                  onConfirm: () => removeStanding(row),
                })
              }
              className="rounded p-1 text-muted hover:text-bad"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <Link
        to="/tournaments"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} /> All tournaments
      </Link>

      <PageHeader
        title={tournament.name}
        subtitle={`${tournament.organizer || 'Organizer not set'}${
          tournament.tier ? ` · ${tournament.tier}` : ''
        }`}
      >
        <TournamentStatusBadge status={tournament.status} />
      </PageHeader>

      <StatGrid cols={6} className="mb-4">
        <StatBox label="Matches" value={totals.matches} />
        <StatBox label="Total points" value={totals.points} color="var(--color-accent)" />
        <StatBox label="Chicken Dinners" value={totals.wwcd} color="#f59e0b" />
        <StatBox label="Finishes" value={totals.finishes} />
        <StatBox label="Avg placement" value={totals.avgPlacement} decimals={2} />
        <StatBox
          label="Our finish"
          value={tournament.final_position ? ordinal(tournament.final_position) : '—'}
          animate={false}
        />
      </StatGrid>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Event details" icon={CalendarDays} />
          <div className="divide-y divide-line">
            <InfoRow label="Starts" value={dateShort(tournament.start_date)} />
            <InfoRow label="Ends" value={dateShort(tournament.end_date)} />
            <InfoRow label="Format" value={tournament.format || '—'} />
            <InfoRow label="Prize pool" value={rupees(tournament.prize_pool)} />
            <InfoRow label="We won" value={rupees(tournament.prize_won)} />
            <InfoRow label="Win rate" value={pct(totals.winRate, 1)} />
          </div>
          {tournament.notes && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-2.5 text-sm text-muted">
              {tournament.notes}
            </p>
          )}
        </Card>

        {own.length > 0 && (
          <TrendLine
            className="lg:col-span-2"
            title="Points & finishes through the event"
            data={trend}
            series={[
              { key: 'points', label: 'Points' },
              { key: 'finishes', label: 'Finishes' },
            ]}
            height={260}
          />
        )}
      </div>

      {own.length > 0 && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <BarCompare
            title="Points per day"
            data={byDay.map((d) => ({ name: `Day ${d.day}`, value: d.points }))}
            dataKey="value"
            label="Points"
            height={230}
          />
          <BarCompare
            title="Points per stage"
            data={byStage.map((s) => ({ name: s.stage, value: s.points }))}
            dataKey="value"
            label="Points"
            color={SERIES[1]}
            height={230}
          />
        </div>
      )}

      {bestPerformer && (
        <Card className="mb-4" glow>
          <CardHeader title="Best performer in this tournament" icon={Users} />
          <Link
            to={`/players/${bestPerformer.player.id}`}
            className="flex flex-wrap items-center gap-4"
          >
            <Avatar
              src={bestPerformer.player.photo_url}
              name={bestPerformer.player.ign}
              role={bestPerformer.player.primary_role}
              size="lg"
            />
            <div>
              <p className="font-head text-xl font-semibold text-fg">
                {bestPerformer.player.ign}
              </p>
              <p className="text-sm text-muted">
                {bestPerformer.finishes} finishes · {num(bestPerformer.damage)} damage ·{' '}
                {bestPerformer.mvps} MVPs
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="num text-4xl text-accent">{bestPerformer.rating}</p>
              <p className="label">Rating</p>
            </div>
          </Link>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader
          title="Overall standings"
          subtitle="Our points are calculated. Add other teams' points to see where we stand."
          icon={Trophy}
          action={
            can.editTournaments && (
              <Button size="sm" variant="secondary" onClick={() => setEditingStanding('new')}>
                <Plus size={14} /> Add team
              </Button>
            )
          }
        />
        <DataTable
          columns={standingColumns}
          rows={table}
          initialSort={{ key: 'total_pts', dir: 'desc' }}
          pageSize={0}
          dense
        />
      </Card>

      <Card>
        <CardHeader title="Our matches" subtitle={`${own.length} matches`} />
        <DataTable
          columns={matchColumns}
          rows={own}
          initialSort={{ key: 'match_number', dir: 'asc' }}
          pageSize={0}
          dense
          empty={
            <p className="py-8 text-center text-sm text-faint">
              No matches tagged to this tournament yet. Pick it in the Add Match form.
            </p>
          }
        />
      </Card>

      {editingStanding && (
        <StandingForm
          open
          tournamentId={tournamentId}
          row={editingStanding === 'new' ? null : editingStanding}
          onClose={() => setEditingStanding(null)}
        />
      )}
      <confirm.Dialog />
    </>
  )
}
