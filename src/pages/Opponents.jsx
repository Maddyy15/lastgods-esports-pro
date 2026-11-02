/**
 * Opponents / Scouting — what we know about the teams we keep running into.
 *
 * "They eliminated us" is counted automatically from the Eliminated by field
 * on each match. "We eliminated them" has to be typed in, because BGMI does
 * not tell us which team each kill belonged to.
 */
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Plus, Shield, Pencil, Trash2, Save, Swords, Crosshair } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { saveRow, deleteRow } from '@/lib/api'
import { readableError } from '@/lib/supabase'

import { Button, Card, EmptyState, PageHeader, Badge } from '@/components/ui/Primitives'
import { Modal, useConfirm } from '@/components/ui/Modal'
import { Input, Select, Textarea, FormGrid, FormSection } from '@/components/ui/Form'
import { MiniStat } from '@/components/ui/StatBox'

const THREAT_COLORS = ['#8d95a6', '#38bdf8', '#22c55e', '#eab308', '#f97316', '#ef4444']

/* ---------------------------------------------------------------------------
 * ADD / EDIT OPPONENT
 * ------------------------------------------------------------------------- */
function OpponentForm({ open, onClose, opponent }) {
  const { reload, maps, opponentSpots } = useData()

  const [form, setForm] = useState(
    () =>
      opponent || {
        name: '',
        tag: '',
        roster: '',
        playstyle_notes: '',
        threat_level: 3,
        we_eliminated: 0,
      },
  )

  // Their usual drop spot per map, edited as a simple map -> text table
  const [spots, setSpots] = useState(() => {
    const existing = opponent
      ? opponentSpots.filter((s) => s.opponent_id === opponent.id)
      : []
    return Object.fromEntries(
      maps.map((m) => [m.id, existing.find((s) => s.map_id === m.id)?.spot_name || '']),
    )
  })

  const [busy, setBusy] = useState(false)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Give the team a name.')

    setBusy(true)
    try {
      const saved = await saveRow('opponents', {
        ...form,
        threat_level: Number(form.threat_level) || 3,
        we_eliminated: Number(form.we_eliminated) || 0,
      })

      // Replace their drop spots with whatever is in the form now
      if (opponent?.id) {
        for (const row of opponentSpots.filter((s) => s.opponent_id === opponent.id)) {
          await deleteRow('opponent_spots', row.id)
        }
      }
      for (const [mapId, spotName] of Object.entries(spots)) {
        if (!spotName.trim()) continue
        await saveRow('opponent_spots', {
          opponent_id: saved.id,
          map_id: mapId,
          spot_name: spotName.trim(),
        })
      }

      await reload()
      toast.success(opponent ? 'Scouting report updated' : 'Opponent added')
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
      onClose={busy ? undefined : onClose}
      title={opponent ? `Edit ${opponent.name}` : 'Add opponent'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="opponent-form" loading={busy}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="opponent-form" onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Team">
          <FormGrid>
            <Input label="Team name" required value={form.name} onChange={setField('name')} />
            <Input label="Tag" value={form.tag || ''} onChange={setField('tag')} placeholder="TTR" />
          </FormGrid>
          <Input
            label="Their roster"
            value={form.roster || ''}
            onChange={setField('roster')}
            placeholder="TTR-BLAZE, TTR-NOVA, TTR-KAI, TTR-RUSH"
            hint="Comma separated IGNs."
          />
          <FormGrid>
            <Select
              label="Threat level"
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} / 5` }))}
              value={form.threat_level}
              onChange={setField('threat_level')}
            />
            <Input
              label="Times we eliminated them"
              type="number"
              min={0}
              value={form.we_eliminated}
              onChange={setField('we_eliminated')}
              hint="Typed in by the coach — the game does not track this."
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Where they drop">
          <div className="grid gap-3 sm:grid-cols-2">
            {maps.map((map) => (
              <Input
                key={map.id}
                label={map.name}
                value={spots[map.id] || ''}
                onChange={(e) => setSpots((s) => ({ ...s, [map.id]: e.target.value }))}
                placeholder="Usual drop"
              />
            ))}
          </div>
        </FormSection>

        <FormSection title="Playstyle">
          <Textarea
            label="Scouting notes"
            rows={5}
            value={form.playstyle_notes || ''}
            onChange={setField('playstyle_notes')}
            placeholder="How they play, what they do well, and how to punish them."
          />
        </FormSection>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------------------- */
export default function Opponents() {
  const { can } = useAuth()
  const { opponents, opponentSpots, matches, maps, mapName, reload } = useData()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(null)

  /** How many times each team knocked us out, read straight from the matches. */
  const eliminationCounts = useMemo(() => {
    const counts = new Map()
    for (const match of matches) {
      if (!match.eliminated_by) continue
      const key = match.eliminated_by.trim().toLowerCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return counts
  }, [matches])

  const contestCounts = useMemo(() => {
    const counts = new Map()
    for (const match of matches) {
      if (!match.contested || !match.contested_against) continue
      const key = match.contested_against.trim().toLowerCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return counts
  }, [matches])

  async function handleDelete(opponent) {
    try {
      await deleteRow('opponents', opponent.id)
      await reload()
      toast.success('Opponent removed')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Opponents"
        subtitle="Scouting reports on the teams we keep meeting"
      >
        {can.editOpponents && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={15} /> Add opponent
          </Button>
        )}
      </PageHeader>

      {!opponents.length ? (
        <EmptyState
          icon={Shield}
          title="No scouting reports yet"
          message="Add the teams you face most often, note where they drop and how they play, and check this page before a tournament."
          action={
            can.editOpponents && (
              <Button onClick={() => setEditing('new')}>
                <Plus size={15} /> Add your first opponent
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {opponents.map((opponent, i) => {
            const key = opponent.name.trim().toLowerCase()
            const theyKilledUs = eliminationCounts.get(key) || 0
            const contested = contestCounts.get(key) || 0
            const spots = opponentSpots.filter((s) => s.opponent_id === opponent.id)
            const threat = THREAT_COLORS[opponent.threat_level] || THREAT_COLORS[3]

            return (
              <Card
                key={opponent.id}
                className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-head text-lg font-semibold text-fg">
                      {opponent.name}
                      {opponent.tag && (
                        <span className="ml-2 text-sm text-faint">[{opponent.tag}]</span>
                      )}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge color={threat} size="sm">
                        Threat {opponent.threat_level}/5
                      </Badge>
                    </div>
                  </div>

                  {can.editOpponents && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(opponent)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() =>
                          confirm.ask({
                            title: `Delete ${opponent.name}?`,
                            message: 'The scouting notes and their drop spots will be lost.',
                            onConfirm: () => handleDelete(opponent),
                          })
                        }
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Head to head */}
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <MiniStat
                    label="They knocked us out"
                    value={theyKilledUs}
                    color={theyKilledUs > 0 ? '#ef4444' : undefined}
                  />
                  <MiniStat
                    label="We knocked them out"
                    value={opponent.we_eliminated}
                    color={opponent.we_eliminated > 0 ? '#22c55e' : undefined}
                  />
                  <MiniStat label="Contested our drop" value={contested} />
                </div>

                {opponent.roster && (
                  <div className="mt-3">
                    <p className="label mb-1">Roster</p>
                    <p className="text-sm text-muted">{opponent.roster}</p>
                  </div>
                )}

                {spots.length > 0 && (
                  <div className="mt-3">
                    <p className="label mb-1.5 flex items-center gap-1">
                      <Crosshair size={11} /> Usual drops
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {spots.map((spot) => (
                        <span
                          key={spot.id}
                          className="rounded-lg border border-line bg-ink/60 px-2 py-1 text-xs"
                        >
                          <span className="text-faint">{mapName(spot.map_id)}:</span>{' '}
                          <span className="text-fg">{spot.spot_name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {opponent.playstyle_notes && (
                  <div className="mt-3">
                    <p className="label mb-1 flex items-center gap-1">
                      <Swords size={11} /> How they play
                    </p>
                    <p className="whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-2.5 text-sm leading-relaxed text-muted">
                      {opponent.playstyle_notes}
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <OpponentForm
          open
          opponent={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <confirm.Dialog />
    </>
  )
}
