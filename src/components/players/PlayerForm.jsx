/**
 * Add / edit a player.
 *
 * THREE TABS
 *   Profile        identity, roles, device, weapons, bio, socials
 *   Overall Stats  carried-over totals from before match logging started
 *   Map Stats      the same idea, but per map
 *
 * WHO SEES WHAT
 *   • Owner / Admin / Coach / Analyst  -> all three tabs
 *   • A Player editing their own card  -> Profile only, and even there their
 *     IGN, roles and roster status are locked
 *
 * Hiding the stat tabs is only the polite half. The database refuses the write
 * as well: player_manual_stats is staff-only under Row Level Security, and
 * guard_player_changes blocks identity edits. See supabase/04_manual_totals.sql.
 */
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Upload } from 'lucide-react'
import { saveRow, uploadFile, savePlayerManualStats } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { GAME_ROLE_OPTIONS, PLAYER_STATUS_OPTIONS } from '@/lib/constants'
import {
  aggregateForPlayer,
  derivePlayerStats,
  emptyManual,
  isBlankManual,
  MANUAL_OVERALL_FIELDS,
  MANUAL_MAP_FIELDS,
} from '@/lib/stats'
import { Modal } from '@/components/ui/Modal'
import { Button, Alert, Tabs } from '@/components/ui/Primitives'
import {
  Input,
  Select,
  Textarea,
  Checkbox,
  FileInput,
  FormGrid,
  FormSection,
} from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Avatar'
import { ManualStatsFields, toMmSs } from './ManualStatsFields'

const BLANK = {
  ign: '',
  real_name: '',
  character_id: '',
  primary_role: 'filler',
  secondary_role: '',
  status: 'active',
  photo_url: '',
  device: '',
  fps_setting: '',
  gyro: true,
  sensitivity_notes: '',
  preferred_ar: '',
  preferred_dmr: '',
  bio: '',
  socials: {},
  join_date: new Date().toISOString().slice(0, 10),
  sort_order: 0,
}

/** Turns a stored carry-over row into the shape the form edits. */
function toFormManual(row, playerId, mapId = null) {
  const base = { ...emptyManual(playerId, mapId), ...(row || {}) }
  return {
    ...base,
    id: row?.id,
    avg_survival_text: toMmSs(base.avg_survival_seconds),
  }
}

/** Turns it back into something the database will accept. */
function toDbManual(form, playerId, mapId = null) {
  const { id, avg_survival_text, created_at, updated_at, ...rest } = form
  const values = { ...rest, player_id: playerId, map_id: mapId }
  // Never send a non-number into a `check (x >= 0)` column.
  for (const [key, value] of Object.entries(values)) {
    if (key === 'player_id' || key === 'map_id' || key === 'note') continue
    values[key] = Math.max(0, Number(value) || 0)
  }
  return { id, blank: isBlankManual(values), ...values }
}

export default function PlayerForm({ open, onClose, player }) {
  const { isStaff, isAdmin } = useAuth()
  const { reload, matches, maps, statsIndex, manualIndex, manualStatsReady } = useData()

  const editing = Boolean(player?.id)
  // Identity fields are locked for anyone who is not staff
  const lockIdentity = editing && !isStaff
  // Only staff may touch stats at all — the stat tabs do not exist for others
  const canEditStats = isStaff

  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState(() => ({ ...BLANK, ...(player || {}) }))
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /* ------------------------------------------------- carried-over totals -- */
  const [manual, setManual] = useState(() =>
    toFormManual(player?.id ? manualIndex.forPlayer(player.id) : null, player?.id),
  )
  const [mapManual, setMapManual] = useState(() => {
    const stored = player?.id ? manualIndex.mapsForPlayer(player.id) : new Map()
    const out = {}
    for (const map of maps) out[map.id] = toFormManual(stored.get(map.id), player?.id, map.id)
    return out
  })
  const [mapTab, setMapTab] = useState(maps[0]?.id || '')

  /**
   * The player's LOGGED totals, with no carry-over mixed in — this is the
   * "+ logged" half of every sum shown beside the inputs.
   */
  const logged = useMemo(() => {
    if (!player?.id) return { overall: null, byMap: {} }
    const overallTotals = aggregateForPlayer(player.id, matches, statsIndex)
    const byMap = {}
    for (const map of maps) {
      const mapMatches = matches.filter((m) => m.map_id === map.id)
      byMap[map.id] = aggregateForPlayer(player.id, mapMatches, statsIndex)
    }
    return {
      overall: { ...overallTotals, ...derivePlayerStats(overallTotals) },
      byMap,
    }
  }, [player?.id, matches, maps, statsIndex])

  /* ------------------------------------------------------------- handlers -- */
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setField = (key) => (e) => set(key)(e.target.value)
  const setSocial = (key) => (e) =>
    setForm((f) => ({ ...f, socials: { ...(f.socials || {}), [key]: e.target.value } }))

  const setManualField = (key, value) => setManual((m) => ({ ...m, [key]: value }))
  const setMapField = (mapId) => (key, value) =>
    setMapManual((all) => ({ ...all, [mapId]: { ...all[mapId], [key]: value } }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.ign.trim()) {
      setError('An in-game name is required.')
      setTab('profile')
      return
    }

    setBusy(true)
    try {
      let photo_url = form.photo_url

      if (photoFile) {
        toast.loading('Uploading photo…', { id: 'upload' })
        photo_url = await uploadFile('avatars', photoFile, 'players')
        toast.dismiss('upload')
      }

      const payload = {
        ...form,
        photo_url,
        // Empty string is not a valid enum / date — send null instead
        secondary_role: form.secondary_role || null,
        join_date: form.join_date || null,
        character_id: form.character_id || null,
        sort_order: Number(form.sort_order) || 0,
      }

      // A player editing themselves must not send the locked columns at all
      if (lockIdentity) {
        delete payload.ign
        delete payload.primary_role
        delete payload.secondary_role
        delete payload.status
      }

      const saved = await saveRow('players', payload)

      // Carry-over totals are a separate table, saved only by staff, and only
      // once the player row exists (a brand-new player has no id until now).
      if (canEditStats && manualStatsReady) {
        const rows = [
          toDbManual(manual, saved.id, null),
          ...maps.map((map) => toDbManual(mapManual[map.id], saved.id, map.id)),
        ]
        await savePlayerManualStats(rows)
      }

      await reload()
      toast.success(editing ? 'Player updated' : 'Player added')
      onClose()
    } catch (err) {
      toast.dismiss('upload')
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  /* ----------------------------------------------------------------- tabs -- */
  const tabs = [
    { value: 'profile', label: 'Profile' },
    ...(canEditStats
      ? [
          { value: 'overall', label: 'Overall Stats' },
          { value: 'maps', label: 'Map Stats' },
        ]
      : []),
  ]

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? `Edit ${player.ign}` : 'Add player'}
      subtitle={
        lockIdentity
          ? 'You can update your own settings and profile details.'
          : 'Roster details, device setup and carried-over stats.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="player-form" loading={busy}>
            <Save size={15} /> {editing ? 'Save changes' : 'Add player'}
          </Button>
        </>
      }
    >
      <form id="player-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

        {/* ================================================= PROFILE TAB === */}
        <div className={tab === 'profile' ? 'space-y-6' : 'hidden'}>
          {/* -------------------------------------------------- identity --- */}
          <FormSection title="Identity">
            <div className="flex items-start gap-4">
              <Avatar
                src={photoFile ? URL.createObjectURL(photoFile) : form.photo_url}
                name={form.ign}
                role={form.primary_role}
                size="lg"
              />
              <div className="flex-1">
                <FileInput
                  label="Player photo"
                  hint="A square image looks best. Max about 2 MB."
                  onFile={setPhotoFile}
                />
                {photoFile && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-win">
                    <Upload size={12} /> {photoFile.name} ready to upload
                  </p>
                )}
              </div>
            </div>

            <FormGrid>
              <Input
                label="In-game name (IGN)"
                required
                value={form.ign}
                onChange={setField('ign')}
                placeholder="LG-SHADOW"
                disabled={lockIdentity}
                hint={lockIdentity ? 'Only an admin can change this.' : undefined}
              />
              <Input
                label="Real name"
                value={form.real_name || ''}
                onChange={setField('real_name')}
                placeholder="Arjun Mehta"
              />
              <Input
                label="Character ID"
                value={form.character_id || ''}
                onChange={setField('character_id')}
                placeholder="5712008841"
                hint="The numeric BGMI ID."
              />
              <Input
                label="Joined on"
                type="date"
                value={form.join_date || ''}
                onChange={setField('join_date')}
              />
            </FormGrid>
          </FormSection>

          {/* ----------------------------------------------------- roles --- */}
          <FormSection title="Roles & status">
            <FormGrid cols={3}>
              <Select
                label="Primary role"
                options={GAME_ROLE_OPTIONS}
                value={form.primary_role}
                onChange={setField('primary_role')}
                disabled={lockIdentity}
              />
              <Select
                label="Secondary role"
                options={GAME_ROLE_OPTIONS}
                placeholder="None"
                value={form.secondary_role || ''}
                onChange={setField('secondary_role')}
                disabled={lockIdentity}
              />
              <Select
                label="Roster status"
                options={PLAYER_STATUS_OPTIONS}
                value={form.status}
                onChange={setField('status')}
                disabled={lockIdentity}
              />
            </FormGrid>
            {isAdmin && (
              <Input
                label="Sort order"
                type="number"
                value={form.sort_order}
                onChange={(e) => set('sort_order')(e.target.value)}
                hint="Lower numbers appear first on the roster."
              />
            )}
          </FormSection>

          {/* ---------------------------------------------------- device --- */}
          <FormSection title="Device & settings">
            <FormGrid>
              <Input
                label="Device"
                value={form.device || ''}
                onChange={setField('device')}
                placeholder="iPhone 15 Pro"
              />
              <Input
                label="FPS setting"
                value={form.fps_setting || ''}
                onChange={setField('fps_setting')}
                placeholder="90 FPS / Smooth"
              />
            </FormGrid>
            <Checkbox
              label="Gyroscope on"
              hint="Turn this off if you play thumb-only."
              checked={form.gyro}
              onChange={set('gyro')}
            />
            <Textarea
              label="Sensitivity notes"
              rows={3}
              value={form.sensitivity_notes || ''}
              onChange={setField('sensitivity_notes')}
              placeholder="Camera 110 / ADS 85 / Gyro 300 — 6x tuned for shoulder peeks"
            />
            <FormGrid>
              <Input
                label="Preferred AR"
                value={form.preferred_ar || ''}
                onChange={setField('preferred_ar')}
                placeholder="M416"
              />
              <Input
                label="Preferred DMR / SR"
                value={form.preferred_dmr || ''}
                onChange={setField('preferred_dmr')}
                placeholder="Mini14"
              />
            </FormGrid>
          </FormSection>

          {/* --------------------------------------------------- socials --- */}
          <FormSection title="Bio & socials">
            <Textarea
              label="Short bio"
              rows={3}
              value={form.bio || ''}
              onChange={setField('bio')}
              placeholder="Calls the drops and the rotations."
            />
            <FormGrid cols={3}>
              <Input
                label="Instagram"
                value={form.socials?.instagram || ''}
                onChange={setSocial('instagram')}
                placeholder="lg_shadow"
              />
              <Input
                label="YouTube"
                value={form.socials?.youtube || ''}
                onChange={setSocial('youtube')}
                placeholder="@lgshadow"
              />
              <Input
                label="X / Twitter"
                value={form.socials?.x || ''}
                onChange={setSocial('x')}
                placeholder="lgshadow"
              />
            </FormGrid>
          </FormSection>
        </div>

        {/* =========================================== OVERALL STATS TAB === */}
        {canEditStats && (
          <div className={tab === 'overall' ? 'space-y-4' : 'hidden'}>
            {!manualStatsReady ? (
              <Alert tone="warn">
                Run <code>supabase/04_manual_totals.sql</code> in the Supabase SQL
                Editor to switch this on. Nothing typed here will save until you do.
              </Alert>
            ) : (
              <>
                <Alert tone="info">
                  Stats from before you started logging matches here. Logged matches
                  are added on top — nothing below is ever overwritten by the app.
                </Alert>
                <ManualStatsFields
                  fields={MANUAL_OVERALL_FIELDS}
                  values={manual}
                  logged={logged.overall}
                  onChange={setManualField}
                  survival
                />
              </>
            )}
          </div>
        )}

        {/* =============================================== MAP STATS TAB === */}
        {canEditStats && (
          <div className={tab === 'maps' ? 'space-y-4' : 'hidden'}>
            {!manualStatsReady ? (
              <Alert tone="warn">
                Run <code>supabase/04_manual_totals.sql</code> in the Supabase SQL
                Editor to switch this on.
              </Alert>
            ) : !maps.length ? (
              <Alert tone="info">Add some maps in Settings first.</Alert>
            ) : (
              <>
                <Alert tone="info">
                  Carried-over totals for one map at a time. These feed the map-wise
                  breakdown on the player profile, the map pages, and any leaderboard
                  filtered to that map.
                </Alert>
                <Tabs
                  tabs={maps.map((m) => ({ value: m.id, label: m.name }))}
                  value={mapTab}
                  onChange={setMapTab}
                />
                {maps.map((map) => (
                  <div key={map.id} className={mapTab === map.id ? '' : 'hidden'}>
                    <ManualStatsFields
                      fields={MANUAL_MAP_FIELDS}
                      values={mapManual[map.id] || {}}
                      logged={logged.byMap[map.id]}
                      onChange={setMapField(map.id)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
