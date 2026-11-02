/**
 * Add / edit a match.
 *
 * Two parts:
 *   1. The match itself — when, where, which map, where we dropped, how it ended.
 *   2. A scoresheet-style table with one row per player.
 *
 * Points are never typed. The database calculates them from the placement and
 * the finishes (see recalc_match in 01_schema.sql); the "Points" preview in
 * this form runs the same formula so you can see the result while typing.
 *
 * Saving also updates every player total, map breakdown, drop-spot record and
 * team statistic — because all of those are calculated from these rows.
 */
import { useState, useMemo, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Save, Trophy, Table2, Rows3, Upload } from 'lucide-react'
import { saveMatch, uploadFile } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { useData } from '@/context/DataContext'
import { calcPoints } from '@/lib/stats'
import { toLocalInput, num } from '@/lib/format'
import {
  MATCH_TYPE_OPTIONS,
  STAGE_OPTIONS,
  PHASE_OPTIONS,
  ZONE_SIDE_OPTIONS,
  ROTATION_OPTIONS,
} from '@/lib/constants'

import { Modal } from '@/components/ui/Modal'
import { Button, Alert, Card } from '@/components/ui/Primitives'
import {
  Input,
  Select,
  Textarea,
  Checkbox,
  NumberInput,
  FileInput,
  FormGrid,
  FormSection,
} from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Avatar'

/* ---------------------------------------------------------------------------
 * The columns of the scoresheet.
 * `quick` marks the ones shown in Quick mode — the numbers you always have in
 * front of you on the result screen.
 * ------------------------------------------------------------------------- */
const STAT_COLUMNS = [
  { key: 'finishes', label: 'Fin', title: 'Finishes (kills)', quick: true },
  { key: 'knocks', label: 'Knk', title: 'Knocks', quick: true },
  { key: 'assists', label: 'Ast', title: 'Assists', quick: true },
  { key: 'damage', label: 'Dmg', title: 'Damage dealt', quick: true, width: 84 },
  { key: 'headshots', label: 'HS', title: 'Headshots' },
  { key: 'revives', label: 'Rev', title: 'Revives' },
  { key: 'survival_seconds', label: 'Surv', title: 'Survival time in seconds', width: 84 },
  { key: 'throwable_damage', label: 'Thrw', title: 'Throwable damage' },
  { key: 'utility_used', label: 'Util', title: 'Utility used (smokes, nades, molotovs)' },
  { key: 'vehicle_kills', label: 'Veh', title: 'Vehicle kills' },
  { key: 'longest_kill', label: 'Long', title: 'Longest kill in metres', width: 84 },
  { key: 'heals_used', label: 'Heal', title: 'Heals used' },
  { key: 'boosts_used', label: 'Bst', title: 'Boosts used' },
]

const blankStats = () =>
  Object.fromEntries(STAT_COLUMNS.map((c) => [c.key, 0]))

function blankMatch() {
  return {
    played_at: toLocalInput(new Date()),
    match_type: 'scrim',
    tournament_id: '',
    scrim_name: '',
    stage: '',
    day_number: '',
    match_number: '',
    map_id: '',
    drop_spot_id: '',
    placement: '',
    teams_in_lobby: 16,
    contested: false,
    contested_against: '',
    zone_side: '',
    rotation_timing: '',
    eliminated_by: '',
    eliminated_phase: '',
    vod_url: '',
    screenshot_url: '',
    coach_notes: '',
  }
}

export default function MatchForm({ open, onClose, match, existingStats = [] }) {
  const { maps, dropSpots, tournaments, players, activePlayers, settings, reload, opponents } =
    useData()

  const editing = Boolean(match?.id)

  /* ------------------------------------------------------------- form state */
  const [form, setForm] = useState(() => {
    if (!match) return { ...blankMatch(), map_id: maps[0]?.id || '' }
    return {
      ...blankMatch(),
      ...match,
      played_at: toLocalInput(match.played_at),
      tournament_id: match.tournament_id || '',
      drop_spot_id: match.drop_spot_id || '',
      stage: match.stage || '',
      eliminated_phase: match.eliminated_phase || '',
      day_number: match.day_number ?? '',
      match_number: match.match_number ?? '',
    }
  })

  /** Which players played, keyed by player id. */
  const [lineup, setLineup] = useState(() => {
    if (editing && existingStats.length) {
      return Object.fromEntries(
        existingStats.map((row) => [
          row.player_id,
          {
            ...blankStats(),
            ...Object.fromEntries(STAT_COLUMNS.map((c) => [c.key, row[c.key] ?? 0])),
            is_mvp: row.is_mvp,
          },
        ]),
      )
    }
    // New match: pre-select the active squad
    return Object.fromEntries(
      activePlayers.slice(0, 4).map((p) => [p.id, { ...blankStats(), is_mvp: false }]),
    )
  })

  const [quickMode, setQuickMode] = useState(true)
  const [screenshot, setScreenshot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setField = (key) => (e) => set(key)(e.target.value)

  /* -------------------------------------------- drop spots follow the map */
  const spotsForMap = useMemo(
    () => dropSpots.filter((s) => s.map_id === form.map_id),
    [dropSpots, form.map_id],
  )

  // If the map changes, a drop spot from the old map no longer makes sense
  useEffect(() => {
    if (form.drop_spot_id && !spotsForMap.some((s) => s.id === form.drop_spot_id)) {
      setForm((f) => ({ ...f, drop_spot_id: '' }))
    }
  }, [spotsForMap, form.drop_spot_id])

  /* ------------------------------------------------------- points preview */
  const totalFinishes = useMemo(
    () => Object.values(lineup).reduce((a, s) => a + (Number(s.finishes) || 0), 0),
    [lineup],
  )

  const pointsTable = useMemo(() => {
    const tournament = tournaments.find((t) => t.id === form.tournament_id)
    return tournament?.points_table || settings.points_table
  }, [tournaments, form.tournament_id, settings.points_table])

  const preview = calcPoints(Number(form.placement) || 0, totalFinishes, pointsTable)

  /* --------------------------------------------------------- line-up edits */
  const togglePlayer = (id, on) =>
    setLineup((current) => {
      const next = { ...current }
      if (on) next[id] = { ...blankStats(), is_mvp: false }
      else delete next[id]
      return next
    })

  const setStat = (playerId, key, value) =>
    setLineup((current) => ({
      ...current,
      [playerId]: { ...current[playerId], [key]: value },
    }))

  /** Only one MVP per match. */
  const setMvp = (playerId, on) =>
    setLineup((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, stats]) => [
          id,
          { ...stats, is_mvp: on && id === playerId },
        ]),
      ),
    )

  const visibleColumns = quickMode ? STAT_COLUMNS.filter((c) => c.quick) : STAT_COLUMNS
  const lineupIds = Object.keys(lineup)

  /* ----------------------------------------------------------------- save */
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.map_id) return setError('Choose which map this match was played on.')
    if (!form.placement) return setError('Enter the placement.')
    if (!lineupIds.length) return setError('Tick at least one player who played.')

    setBusy(true)
    try {
      let screenshot_url = form.screenshot_url
      if (screenshot) {
        toast.loading('Uploading screenshot…', { id: 'shot' })
        screenshot_url = await uploadFile('screenshots', screenshot, 'matches')
        toast.dismiss('shot')
      }

      const payload = {
        ...(editing ? { id: match.id } : {}),
        played_at: new Date(form.played_at).toISOString(),
        match_type: form.match_type,
        tournament_id: form.tournament_id || null,
        scrim_name: form.scrim_name || null,
        stage: form.stage || null,
        day_number: form.day_number === '' ? null : Number(form.day_number),
        match_number: form.match_number === '' ? null : Number(form.match_number),
        map_id: form.map_id,
        drop_spot_id: form.drop_spot_id || null,
        placement: Number(form.placement),
        teams_in_lobby: Number(form.teams_in_lobby) || 16,
        contested: Boolean(form.contested),
        contested_against: form.contested_against || null,
        zone_side: form.zone_side || null,
        rotation_timing: form.rotation_timing || null,
        eliminated_by: form.eliminated_by || null,
        eliminated_phase: form.eliminated_phase || null,
        vod_url: form.vod_url || null,
        screenshot_url: screenshot_url || null,
        coach_notes: form.coach_notes || null,
      }

      const playerRows = lineupIds.map((playerId) => {
        const stats = lineup[playerId]
        const row = { player_id: playerId, is_mvp: Boolean(stats.is_mvp) }
        for (const col of STAT_COLUMNS) row[col.key] = Number(stats[col.key]) || 0
        return row
      })

      await saveMatch(payload, playerRows)
      await reload()
      toast.success(editing ? 'Match updated' : 'Match saved — stats recalculated')
      onClose()
    } catch (err) {
      toast.dismiss('shot')
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  /* --------------------------------------------------------------- render */
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? `Edit match #${match.match_number ?? ''}` : 'Add match'}
      subtitle="Points are calculated for you from the placement and finishes."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="match-form" loading={busy}>
            <Save size={15} /> {editing ? 'Save changes' : 'Save match'}
          </Button>
        </>
      }
    >
      <form id="match-form" onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {/* ------------------------------------------------ live points --- */}
        <Card glow className="flex flex-wrap items-center justify-around gap-4 py-3">
          {[
            { label: 'Placement pts', value: preview.placementPts },
            { label: 'Finish pts', value: preview.finishPts },
            { label: 'Total points', value: preview.total, accent: true },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="label">{item.label}</p>
              <p
                className="num text-3xl"
                style={{ color: item.accent ? 'var(--color-accent)' : undefined }}
              >
                {item.value}
              </p>
            </div>
          ))}
          {Number(form.placement) === 1 && (
            <div className="flex items-center gap-2 text-accent">
              <Trophy size={20} />
              <span className="font-head font-semibold uppercase">Chicken Dinner</span>
            </div>
          )}
        </Card>

        {/* --------------------------------------------------- when/what --- */}
        <FormSection title="Match details">
          <FormGrid cols={3}>
            <Input
              label="Date & time"
              type="datetime-local"
              required
              value={form.played_at}
              onChange={setField('played_at')}
            />
            <Select
              label="Match type"
              options={MATCH_TYPE_OPTIONS}
              value={form.match_type}
              onChange={setField('match_type')}
            />
            <Select
              label="Tournament"
              options={tournaments.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="None (scrim or practice)"
              value={form.tournament_id}
              onChange={setField('tournament_id')}
            />
          </FormGrid>

          <FormGrid cols={3}>
            {!form.tournament_id && (
              <Input
                label="Scrim / lobby name"
                value={form.scrim_name || ''}
                onChange={setField('scrim_name')}
                placeholder="Tier-1 Practice Lobby"
              />
            )}
            <Select
              label="Stage"
              options={STAGE_OPTIONS}
              placeholder="Not applicable"
              value={form.stage}
              onChange={setField('stage')}
            />
            <Input
              label="Day number"
              type="number"
              min={1}
              value={form.day_number}
              onChange={setField('day_number')}
            />
            <Input
              label="Match number"
              type="number"
              min={1}
              value={form.match_number}
              onChange={setField('match_number')}
            />
          </FormGrid>
        </FormSection>

        {/* --------------------------------------------------- map & drop --- */}
        <FormSection title="Map & drop">
          <FormGrid cols={3}>
            <Select
              label="Map"
              required
              options={maps.map((m) => ({ value: m.id, label: m.name }))}
              placeholder="Choose a map"
              value={form.map_id}
              onChange={setField('map_id')}
            />
            <Select
              label="Drop spot"
              options={spotsForMap.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={form.map_id ? 'Choose a spot' : 'Pick a map first'}
              value={form.drop_spot_id}
              onChange={setField('drop_spot_id')}
              disabled={!form.map_id}
              hint="Add new spots in Settings → Maps & drop spots."
            />
            <Select
              label="First circle side"
              options={ZONE_SIDE_OPTIONS}
              placeholder="Not noted"
              value={form.zone_side}
              onChange={setField('zone_side')}
            />
          </FormGrid>

          <div className="space-y-3 rounded-xl border border-line bg-ink/40 p-3">
            <Checkbox
              label="We were contested at drop"
              checked={form.contested}
              onChange={set('contested')}
            />
            {form.contested && (
              <Input
                label="Contested by"
                value={form.contested_against || ''}
                onChange={setField('contested_against')}
                placeholder="Titan Reapers"
                list="opponent-names"
              />
            )}
            <Select
              label="Rotation timing"
              options={ROTATION_OPTIONS}
              placeholder="Not noted"
              value={form.rotation_timing}
              onChange={setField('rotation_timing')}
            />
          </div>
        </FormSection>

        {/* ------------------------------------------------------ result --- */}
        <FormSection title="Result">
          <FormGrid cols={3}>
            <Input
              label="Placement"
              type="number"
              min={1}
              max={100}
              required
              value={form.placement}
              onChange={setField('placement')}
              placeholder="1"
            />
            <Input
              label="Teams in lobby"
              type="number"
              min={2}
              value={form.teams_in_lobby}
              onChange={setField('teams_in_lobby')}
            />
            <Select
              label="Eliminated in"
              options={PHASE_OPTIONS}
              placeholder="Not noted"
              value={form.eliminated_phase}
              onChange={setField('eliminated_phase')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Eliminated by"
              value={form.eliminated_by || ''}
              onChange={setField('eliminated_by')}
              placeholder="Team name"
              list="opponent-names"
            />
            <Input
              label="VOD / recording link"
              type="url"
              value={form.vod_url || ''}
              onChange={setField('vod_url')}
              placeholder="https://youtube.com/watch?v=…"
            />
          </FormGrid>

          {/* Autocomplete source for the two team-name fields above */}
          <datalist id="opponent-names">
            {opponents.map((o) => (
              <option key={o.id} value={o.name} />
            ))}
          </datalist>
        </FormSection>

        {/* --------------------------------------------------- scoresheet --- */}
        <FormSection title="Player stats">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Tick everyone who played, then fill the numbers from the result screen.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setQuickMode((q) => !q)}
            >
              {quickMode ? <Table2 size={14} /> : <Rows3 size={14} />}
              {quickMode ? 'Show all columns' : 'Quick entry'}
            </Button>
          </div>

          {/* Who played */}
          <div className="flex flex-wrap gap-2">
            {players.map((player) => {
              const picked = Boolean(lineup[player.id])
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player.id, !picked)}
                  className={
                    'flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-accent ' +
                    (picked
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-line text-muted hover:border-accent/40 hover:text-fg')
                  }
                >
                  <Avatar
                    src={player.photo_url}
                    name={player.ign}
                    role={player.primary_role}
                    size="xs"
                  />
                  {player.ign}
                </button>
              )
            })}
          </div>

          {/* The scoresheet */}
          {lineupIds.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface">
                    <th className="label sticky left-0 z-10 bg-surface px-3 py-2 text-left">
                      Player
                    </th>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.key}
                        title={col.title}
                        className="label px-1.5 py-2 text-center"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="label px-2 py-2 text-center" title="Match MVP">
                      MVP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineupIds.map((playerId) => {
                    const player = players.find((p) => p.id === playerId)
                    const stats = lineup[playerId]
                    if (!player) return null

                    return (
                      <tr key={playerId} className="border-t border-line">
                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={player.photo_url}
                              name={player.ign}
                              role={player.primary_role}
                              size="xs"
                            />
                            <span className="whitespace-nowrap text-xs font-medium text-fg">
                              {player.ign}
                            </span>
                          </div>
                        </td>

                        {visibleColumns.map((col) => (
                          <td key={col.key} className="px-1 py-1.5">
                            <NumberInput
                              value={stats[col.key]}
                              onChange={(v) => setStat(playerId, col.key, v)}
                              step={col.key === 'longest_kill' ? 0.1 : 1}
                              className="px-1 py-1.5"
                              style={{ width: col.width || 60 }}
                              aria-label={`${player.ign} ${col.title}`}
                            />
                          </td>
                        ))}

                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(stats.is_mvp)}
                            onChange={(e) => setMvp(playerId, e.target.checked)}
                            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                            aria-label={`${player.ign} is MVP`}
                          />
                        </td>
                      </tr>
                    )
                  })}

                  {/* Team totals row */}
                  <tr className="border-t-2 border-line bg-surface font-semibold">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 text-xs">
                      Team total
                    </td>
                    {visibleColumns.map((col) => {
                      const total = Object.values(lineup).reduce(
                        (a, s) => a + (Number(s[col.key]) || 0),
                        0,
                      )
                      return (
                        <td
                          key={col.key}
                          className="px-1.5 py-2 text-center font-head tabular-nums text-accent"
                        >
                          {col.key === 'longest_kill'
                            ? num(
                                Math.max(
                                  0,
                                  ...Object.values(lineup).map(
                                    (s) => Number(s.longest_kill) || 0,
                                  ),
                                ),
                                0,
                              )
                            : num(total)}
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </FormSection>

        {/* ------------------------------------------------- notes & shot --- */}
        <FormSection title="Notes & proof">
          <Textarea
            label="Coach's notes"
            rows={4}
            value={form.coach_notes || ''}
            onChange={setField('coach_notes')}
            placeholder="What went well, and the one mistake to fix before the next match."
          />
          <FileInput
            label="Result screenshot"
            hint="Optional — the end-of-match scoreboard."
            onFile={setScreenshot}
          />
          {screenshot && (
            <p className="flex items-center gap-1 text-xs text-win">
              <Upload size={12} /> {screenshot.name} ready to upload
            </p>
          )}
        </FormSection>
      </form>
    </Modal>
  )
}
