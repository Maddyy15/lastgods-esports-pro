/**
 * Tournaments — every event we have entered, with our result and prize money.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trophy, Pencil, Trash2, Calendar, IndianRupee, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { saveRow, deleteRow } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { aggregateTeam, deriveTeam } from '@/lib/stats'
import { dateShort, rupees, ordinal, num } from '@/lib/format'
import {
  TOURNAMENT_STATUS_OPTIONS,
  TOURNAMENT_TIER_OPTIONS,
  TOURNAMENT_STATUS,
} from '@/lib/constants'

import { Button, Card, EmptyState, PageHeader, Tabs } from '@/components/ui/Primitives'
import { Modal, useConfirm } from '@/components/ui/Modal'
import { Input, Select, Textarea, FormGrid, FormSection } from '@/components/ui/Form'
import { StatBox, StatGrid, MiniStat } from '@/components/ui/StatBox'
import { TournamentStatusBadge } from '@/components/ui/Chips'

/* ---------------------------------------------------------------------------
 * ADD / EDIT FORM
 * ------------------------------------------------------------------------- */
const BLANK = {
  name: '',
  organizer: '',
  tier: 'Third-party',
  start_date: '',
  end_date: '',
  format: '',
  prize_pool: '',
  final_position: '',
  prize_won: '',
  status: 'upcoming',
  notes: '',
}

function TournamentForm({ open, onClose, tournament }) {
  const { reload } = useData()
  const [form, setForm] = useState(() => ({ ...BLANK, ...(tournament || {}) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Give the tournament a name.')

    setBusy(true)
    setError(null)
    try {
      await saveRow('tournaments', {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        prize_pool: form.prize_pool === '' ? null : Number(form.prize_pool),
        prize_won: form.prize_won === '' ? null : Number(form.prize_won),
        final_position: form.final_position === '' ? null : Number(form.final_position),
      })
      await reload()
      toast.success(tournament ? 'Tournament updated' : 'Tournament added')
      onClose()
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={tournament ? 'Edit tournament' : 'Add tournament'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="tournament-form" loading={busy}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="tournament-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-bad">{error}</p>}

        <FormSection title="Event">
          <FormGrid>
            <Input
              label="Name"
              required
              value={form.name}
              onChange={setField('name')}
              placeholder="BGMI Masters Series 2026"
            />
            <Input
              label="Organizer"
              value={form.organizer || ''}
              onChange={setField('organizer')}
              placeholder="Krafton"
            />
            <Select label="Tier" options={TOURNAMENT_TIER_OPTIONS} value={form.tier} onChange={setField('tier')} />
            <Select
              label="Status"
              options={TOURNAMENT_STATUS_OPTIONS}
              value={form.status}
              onChange={setField('status')}
            />
            <Input label="Start date" type="date" value={form.start_date || ''} onChange={setField('start_date')} />
            <Input label="End date" type="date" value={form.end_date || ''} onChange={setField('end_date')} />
          </FormGrid>
          <Input
            label="Format"
            value={form.format || ''}
            onChange={setField('format')}
            placeholder="16 teams, 8 matches, points format"
          />
        </FormSection>

        <FormSection title="Result">
          <FormGrid cols={3}>
            <Input
              label="Prize pool (₹)"
              type="number"
              value={form.prize_pool ?? ''}
              onChange={setField('prize_pool')}
            />
            <Input
              label="Our final position"
              type="number"
              min={1}
              value={form.final_position ?? ''}
              onChange={setField('final_position')}
            />
            <Input
              label="Prize won (₹)"
              type="number"
              value={form.prize_won ?? ''}
              onChange={setField('prize_won')}
            />
          </FormGrid>
          <Textarea label="Notes" rows={3} value={form.notes || ''} onChange={setField('notes')} />
        </FormSection>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------------------- */
export default function Tournaments() {
  const { can } = useAuth()
  const { tournaments, matches, reload } = useData()
  const confirm = useConfirm()

  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  const rows = useMemo(
    () =>
      tournaments.map((tournament) => {
        const own = matches.filter((m) => m.tournament_id === tournament.id)
        return { tournament, stats: deriveTeam(aggregateTeam(own)) }
      }),
    [tournaments, matches],
  )

  const visible = filter === 'all' ? rows : rows.filter((r) => r.tournament.status === filter)

  const totals = useMemo(
    () => ({
      played: tournaments.length,
      won: tournaments.filter((t) => t.final_position === 1).length,
      top3: tournaments.filter((t) => t.final_position && t.final_position <= 3).length,
      earnings: tournaments.reduce((a, t) => a + (Number(t.prize_won) || 0), 0),
    }),
    [tournaments],
  )

  const tabs = [
    { value: 'all', label: 'All', count: rows.length },
    ...Object.entries(TOURNAMENT_STATUS).map(([value, meta]) => ({
      value,
      label: meta.label,
      count: rows.filter((r) => r.tournament.status === value).length,
    })),
  ]

  async function handleDelete(tournament) {
    try {
      await deleteRow('tournaments', tournament.id)
      await reload()
      toast.success('Tournament deleted')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <PageHeader title="Tournaments" subtitle={`${tournaments.length} events entered`}>
        {can.editTournaments && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={15} /> Add tournament
          </Button>
        )}
      </PageHeader>

      {tournaments.length > 0 && (
        <StatGrid cols={4} className="mb-4">
          <StatBox label="Tournaments played" value={totals.played} icon={Trophy} />
          <StatBox label="Titles won" value={totals.won} color="#f59e0b" />
          <StatBox label="Top 3 finishes" value={totals.top3} />
          <StatBox
            label="Total earnings"
            value={rupees(totals.earnings)}
            animate={false}
            icon={IndianRupee}
            color="var(--color-accent)"
          />
        </StatGrid>
      )}

      {rows.length > 0 && (
        <Tabs tabs={tabs} value={filter} onChange={setFilter} className="mb-4 max-w-lg" />
      )}

      {!visible.length ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          message="Add an event, then tag your matches to it — the tournament page will total the points for you."
          action={
            can.editTournaments && (
              <Button onClick={() => setEditing('new')}>
                <Plus size={15} /> Add your first tournament
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(({ tournament, stats }, i) => (
            <Card
              key={tournament.id}
              hover
              className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/tournaments/${tournament.id}`}
                    className="font-head text-lg font-semibold text-fg transition-colors hover:text-accent"
                  >
                    {tournament.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {tournament.organizer || 'Organizer not set'}
                    {tournament.tier && ` · ${tournament.tier}`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <TournamentStatusBadge status={tournament.status} size="sm" />
                    {tournament.start_date && (
                      <span className="flex items-center gap-1 text-[11px] text-faint">
                        <Calendar size={11} />
                        {dateShort(tournament.start_date)}
                        {tournament.end_date && ` — ${dateShort(tournament.end_date)}`}
                      </span>
                    )}
                  </div>
                </div>

                {can.editTournaments && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(tournament)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: `Delete ${tournament.name}?`,
                          message:
                            'The matches stay, but they will no longer be linked to this tournament.',
                          onConfirm: () => handleDelete(tournament),
                        })
                      }
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <MiniStat label="Matches" value={stats.matches} />
                <MiniStat label="Points" value={num(stats.points)} color="var(--color-accent)" />
                <MiniStat label="WWCD" value={stats.wwcd} />
                <MiniStat
                  label="Finish"
                  value={tournament.final_position ? ordinal(tournament.final_position) : '—'}
                />
              </div>

              {(tournament.prize_won || tournament.prize_pool) && (
                <p className="mt-2.5 border-t border-line pt-2 text-xs text-muted">
                  {tournament.prize_won ? (
                    <>
                      Won <span className="font-semibold text-win">{rupees(tournament.prize_won)}</span>
                    </>
                  ) : (
                    <>Prize pool {rupees(tournament.prize_pool)}</>
                  )}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TournamentForm
          open
          tournament={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <confirm.Dialog />
    </>
  )
}
