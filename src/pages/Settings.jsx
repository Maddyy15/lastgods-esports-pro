/**
 * Settings — Owner / Admin only.
 *
 * Seven sections: team branding, team totals, users, maps & drop spots,
 * the points table, the rating weights, and data export/import plus the
 * activity log.
 */
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Save,
  Plus,
  Trash2,
  Upload,
  Download,
  Users,
  Map as MapIcon,
  Palette,
  Calculator,
  Sliders,
  Database,
  Activity,
  RotateCcw,
  Link2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import {
  saveSettings,
  saveRow,
  deleteRow,
  updateProfile,
  uploadFile,
  clearActivity,
} from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { aggregateTeam, deriveTeam } from '@/lib/stats'
import {
  downloadCSV,
  downloadJSON,
  buildBackup,
  parseCSV,
  EXPORTABLE_TABLES,
} from '@/lib/csv'
import {
  APP_ROLE_OPTIONS,
  DEFAULT_POINTS_TABLE,
  DEFAULT_RATING_WEIGHTS,
} from '@/lib/constants'
import { dateTime, num, cx } from '@/lib/format'

import { Button, Card, CardHeader, PageHeader, Tabs, Toggle, Alert, Badge } from '@/components/ui/Primitives'
import { Input, Select, FileInput, FormGrid, NumberInput } from '@/components/ui/Form'
import { useConfirm } from '@/components/ui/Modal'
import { TeamLogo, Avatar } from '@/components/ui/Avatar'
import { AppRoleBadge } from '@/components/ui/Chips'
import { DataTable } from '@/components/ui/DataTable'

const SECTIONS = [
  { value: 'team', label: 'Team', icon: Palette },
  { value: 'totals', label: 'Totals', icon: Calculator },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'maps', label: 'Maps & spots', icon: MapIcon },
  { value: 'scoring', label: 'Scoring', icon: Sliders },
  { value: 'data', label: 'Data', icon: Database },
  { value: 'activity', label: 'Activity log', icon: Activity },
]

/* ===========================================================================
 * 1. TEAM BRANDING
 * ========================================================================= */
function TeamSection() {
  const data = useData()
  const { settings, reload, applyAccent } = data

  const [form, setForm] = useState({
    team_name: settings.team_name,
    tagline: settings.tagline || '',
    accent_color: settings.accent_color,
  })
  const [logo, setLogo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      let logo_url = settings.logo_url
      if (logo) logo_url = await uploadFile('branding', logo, 'logo')
      await saveSettings({ ...form, logo_url })
      await reload()
      applyAccent(form.accent_color)
      toast.success('Team settings saved')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  const presets = ['#f59e0b', '#ef4444', '#22c55e', '#0ea5e9', '#a855f7', '#ec4899']

  return (
    <Card>
      <CardHeader title="Team identity" subtitle="Shown in the sidebar and on the dashboard" />

      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="shrink-0 text-center">
          <TeamLogo
            src={logo ? URL.createObjectURL(logo) : settings.logo_url}
            name={form.team_name}
            size="xl"
          />
          <p className="mt-2 text-[11px] text-faint">Current logo</p>
        </div>

        <div className="flex-1 space-y-4">
          <FormGrid>
            <Input
              label="Team name"
              value={form.team_name}
              onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))}
            />
            <Input
              label="Tagline"
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            />
          </FormGrid>

          <FileInput label="Team logo" hint="A square PNG works best." onFile={setLogo} />

          <div>
            <p className="label mb-2">Accent colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {presets.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setForm((f) => ({ ...f, accent_color: color }))
                    applyAccent(color)
                  }}
                  className={cx(
                    'h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110',
                    form.accent_color === color ? 'border-fg' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Use ${color}`}
                />
              ))}
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => {
                  setForm((f) => ({ ...f, accent_color: e.target.value }))
                  applyAccent(e.target.value)
                }}
                className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-ink p-0.5"
              />
              <span className="font-mono text-xs uppercase text-muted">
                {form.accent_color}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-faint">
              Chart colours stay fixed — they are tuned for colour-blind readability
              against the dark background.
            </p>
          </div>

          <Button onClick={save} loading={busy}>
            <Save size={15} /> Save team settings
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ===========================================================================
 * 2. TEAM TOTALS (auto vs manual)
 * ========================================================================= */
const TOTAL_FIELDS = [
  { key: 'matches', label: 'Matches played' },
  { key: 'wwcd', label: 'Chicken Dinners' },
  { key: 'winRate', label: 'Win rate %' },
  { key: 'finishes', label: 'Total finishes' },
  { key: 'damage', label: 'Total damage' },
  { key: 'points', label: 'Total points' },
  { key: 'avgPlacement', label: 'Avg placement' },
  { key: 'avgPoints', label: 'Avg points / match' },
  { key: 'avgFinishes', label: 'Avg kills / match' },
  { key: 'top5Rate', label: 'Top 5 rate %' },
]

function TotalsSection() {
  const { settings, matches, reload } = useData()
  const live = useMemo(() => deriveTeam(aggregateTeam(matches)), [matches])

  const [auto, setAuto] = useState(settings.auto_calculate_totals)
  const [manual, setManual] = useState(settings.manual_totals || {})
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await saveSettings({ auto_calculate_totals: auto, manual_totals: manual })
      await reload()
      toast.success('Dashboard totals updated')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Dashboard totals"
        subtitle="Normally calculated from your matches — switch this off to type them in yourself"
      />

      <div className="mb-4 rounded-xl border border-line bg-ink/50 p-3">
        <Toggle
          label="Auto-calculate from matches"
          hint={
            auto
              ? 'On — every total is calculated live from your match log.'
              : 'Off — the dashboard shows the numbers you type below.'
          }
          checked={auto}
          onChange={setAuto}
        />
      </div>

      {!auto && (
        <Alert tone="warn" className="mb-4" title="Manual override is on">
          Leave a box empty to keep using the calculated value for that one stat.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOTAL_FIELDS.map((field) => (
          <div key={field.key} className="rounded-lg border border-line bg-ink/40 p-2.5">
            <p className="label mb-1">{field.label}</p>
            <p className="mb-1.5 text-[11px] text-faint">
              Calculated: <span className="text-muted">{num(live[field.key], 2)}</span>
            </p>
            <Input
              type="number"
              step="any"
              disabled={auto}
              placeholder={auto ? 'Auto' : 'Leave empty for auto'}
              value={manual[field.key] ?? ''}
              onChange={(e) =>
                setManual((m) => ({
                  ...m,
                  [field.key]: e.target.value === '' ? undefined : e.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>

      <Button className="mt-4" onClick={save} loading={busy}>
        <Save size={15} /> Save totals
      </Button>
    </Card>
  )
}

/* ===========================================================================
 * 3. USERS
 * ========================================================================= */
function UsersSection() {
  const { profiles, players, reload } = useData()
  const { user } = useAuth()
  const confirm = useConfirm()
  const [busyId, setBusyId] = useState(null)

  async function changeRole(profile, role) {
    setBusyId(profile.id)
    try {
      await updateProfile(profile.id, { role })
      await reload()
      toast.success(`${profile.full_name || profile.email} is now ${role}`)
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusyId(null)
    }
  }

  async function linkPlayer(profile, playerId) {
    setBusyId(profile.id)
    try {
      await updateProfile(profile.id, { player_id: playerId || null })
      await reload()
      toast.success('Account linked')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusyId(null)
    }
  }

  async function removeProfile(profile) {
    try {
      await deleteRow('profiles', profile.id)
      await reload()
      toast.success('Profile removed')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <Alert tone="info" className="mb-4" title="How to add someone to the team">
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs">
          <li>
            Open your Supabase dashboard → <strong>Authentication → Users</strong> →{' '}
            <strong>Add user</strong>.
          </li>
          <li>
            Enter their email. Tick <em>Auto Confirm User</em> so they can sign in
            straight away.
          </li>
          <li>They appear in the table below — set their permission level here.</li>
          <li>
            They sign in at your site and use <em>Forgot your password?</em> to set one.
          </li>
        </ol>
      </Alert>

      <Card>
        <CardHeader title="Team members" icon={Users} subtitle={`${profiles.length} accounts`} />

        <div className="space-y-2">
          {profiles.map((profile) => {
            const linked = players.find((p) => p.id === profile.player_id)
            const isMe = profile.id === user?.id

            return (
              <div
                key={profile.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-ink/40 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar
                    src={linked?.photo_url || profile.avatar_url}
                    name={profile.full_name || profile.email}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {profile.full_name || '—'}
                      {isMe && (
                        <Badge color="#f59e0b" size="sm" className="ml-2">
                          You
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{profile.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <AppRoleBadge role={profile.role} size="sm" />

                  <Select
                    options={APP_ROLE_OPTIONS}
                    value={profile.role}
                    disabled={busyId === profile.id}
                    onChange={(e) => changeRole(profile, e.target.value)}
                    className="h-9 w-32 text-xs"
                  />

                  <Select
                    options={players.map((p) => ({ value: p.id, label: p.ign }))}
                    placeholder="Not a player"
                    value={profile.player_id || ''}
                    disabled={busyId === profile.id}
                    onChange={(e) => linkPlayer(profile, e.target.value)}
                    className="h-9 w-36 text-xs"
                  />

                  {!isMe && (
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: 'Remove this profile?',
                          message:
                            'They will lose access to the site. The login itself still exists in Supabase — delete it there too if you want it gone completely.',
                          onConfirm: () => removeProfile(profile),
                        })
                      }
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
          <Link2 size={12} /> Linking an account to a player lets that person edit their
          own player card and mark their own availability.
        </p>
      </Card>

      <confirm.Dialog />
    </>
  )
}

/* ===========================================================================
 * 4. MAPS & DROP SPOTS
 * ========================================================================= */
function MapsSection() {
  const { maps, dropSpots, reload } = useData()
  const confirm = useConfirm()

  const [newMap, setNewMap] = useState('')
  const [spotDraft, setSpotDraft] = useState({})
  const [busy, setBusy] = useState(false)

  async function addMap() {
    if (!newMap.trim()) return
    setBusy(true)
    try {
      await saveRow('maps', {
        name: newMap.trim(),
        slug: newMap.trim().toLowerCase().replace(/\s+/g, '-'),
        sort_order: maps.length + 1,
      })
      await reload()
      setNewMap('')
      toast.success('Map added')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  async function addSpot(mapId) {
    const name = (spotDraft[mapId] || '').trim()
    if (!name) return
    try {
      await saveRow('drop_spots', { map_id: mapId, name })
      await reload()
      setSpotDraft((d) => ({ ...d, [mapId]: '' }))
      toast.success('Drop spot added')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  async function remove(table, id, label) {
    try {
      await deleteRow(table, id)
      await reload()
      toast.success(`${label} deleted`)
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader title="Add a map" icon={MapIcon} />
        <div className="flex gap-2">
          <Input
            placeholder="Map name"
            value={newMap}
            onChange={(e) => setNewMap(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMap())}
          />
          <Button onClick={addMap} loading={busy}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {maps.map((map) => {
          const spots = dropSpots.filter((s) => s.map_id === map.id)
          return (
            <Card key={map.id}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-head text-lg font-semibold text-fg">{map.name}</h3>
                <button
                  onClick={() =>
                    confirm.ask({
                      title: `Delete ${map.name}?`,
                      message:
                        'You cannot delete a map that has matches logged on it. Its drop spots will be deleted too.',
                      onConfirm: () => remove('maps', map.id, 'Map'),
                    })
                  }
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {spots.length ? (
                  spots.map((spot) => (
                    <span
                      key={spot.id}
                      className="group flex items-center gap-1 rounded-lg border border-line bg-ink/60 px-2 py-1 text-xs text-muted"
                    >
                      {spot.name}
                      <button
                        onClick={() =>
                          confirm.ask({
                            title: `Delete ${spot.name}?`,
                            message:
                              'Matches that used this spot will show "—" instead.',
                            onConfirm: () => remove('drop_spots', spot.id, 'Drop spot'),
                          })
                        }
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-bad"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-faint">No drop spots yet</span>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="New drop spot"
                  value={spotDraft[map.id] || ''}
                  onChange={(e) => setSpotDraft((d) => ({ ...d, [map.id]: e.target.value }))}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && (e.preventDefault(), addSpot(map.id))
                  }
                />
                <Button size="sm" variant="secondary" onClick={() => addSpot(map.id)}>
                  <Plus size={14} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <confirm.Dialog />
    </>
  )
}

/* ===========================================================================
 * 5. SCORING — points table + rating weights
 * ========================================================================= */
function ScoringSection() {
  const { settings, reload } = useData()

  const [points, setPoints] = useState(() => ({ ...settings.points_table }))
  const [weights, setWeights] = useState(() => ({ ...settings.rating_weights }))
  const [busy, setBusy] = useState(false)

  const weightTotal = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0)

  async function save() {
    setBusy(true)
    try {
      await saveSettings({
        points_table: Object.fromEntries(
          Object.entries(points)
            .filter(([, v]) => v !== '' && v !== null)
            .map(([k, v]) => [k, Number(v)]),
        ),
        rating_weights: Object.fromEntries(
          Object.entries(weights).map(([k, v]) => [k, Number(v) || 0]),
        ),
      })
      await reload()
      toast.success('Scoring saved — existing matches keep their points until re-saved')
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="Placement points"
          subtitle="The BGMI esports format. Any placement not listed scores 0."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPoints({ ...DEFAULT_POINTS_TABLE })}
            >
              <RotateCcw size={13} /> Reset
            </Button>
          }
        />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((place) => (
            <div key={place} className="rounded-lg border border-line bg-ink/40 p-2 text-center">
              <p className="label mb-1">{place === 1 ? 'WWCD' : `#${place}`}</p>
              <NumberInput
                value={points[place] ?? 0}
                onChange={(v) => setPoints((p) => ({ ...p, [place]: v }))}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-faint">
          A tournament can override this with its own format. Changing it here affects
          matches from the next time they are saved.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Player rating weights"
          subtitle="How much each part of the game counts towards the 0–100 rating"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeights({ ...DEFAULT_RATING_WEIGHTS })}
            >
              <RotateCcw size={13} /> Reset
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { key: 'finishes', label: 'Finishes', benchmark: '5 per match = 100%' },
            { key: 'damage', label: 'Damage', benchmark: '800 per match = 100%' },
            { key: 'assists', label: 'Assists', benchmark: '3 per match = 100%' },
            { key: 'survival', label: 'Survival', benchmark: '18 min per match = 100%' },
            { key: 'revives', label: 'Revives', benchmark: '1.5 per match = 100%' },
          ].map((item) => (
            <div key={item.key} className="rounded-lg border border-line bg-ink/40 p-3">
              <p className="label mb-1">{item.label}</p>
              <NumberInput
                value={weights[item.key] ?? 0}
                onChange={(v) => setWeights((w) => ({ ...w, [item.key]: v }))}
              />
              <p className="mt-1 text-[10px] leading-tight text-faint">{item.benchmark}</p>
            </div>
          ))}
        </div>

        <p
          className={cx(
            'mt-3 text-sm font-semibold',
            weightTotal === 100 ? 'text-win' : 'text-warn',
          )}
        >
          Weights add up to {weightTotal}
          {weightTotal !== 100 && ' — they work best at exactly 100.'}
        </p>

        <Button className="mt-4" onClick={save} loading={busy}>
          <Save size={15} /> Save scoring
        </Button>
      </Card>
    </>
  )
}

/* ===========================================================================
 * 6. DATA — export and import
 * ========================================================================= */
function DataSection() {
  const data = useData()
  const [importing, setImporting] = useState(false)

  function exportTable(key, label) {
    const rows = data[key] || []
    if (!rows.length) return toast.error(`${label} is empty`)
    downloadCSV(`lastgods-${key}`, rows)
    toast.success(`${label} exported`)
  }

  function exportEverything() {
    downloadJSON(`lastgods-backup-${new Date().toISOString().slice(0, 10)}`, buildBackup(data))
    toast.success('Full backup downloaded')
  }

  /**
   * Import players from a CSV. Kept deliberately narrow: importing matches
   * safely would need player IDs to line up, and a wrong import is much
   * harder to undo than re-typing a few rows.
   */
  async function importPlayers(file) {
    if (!file) return
    setImporting(true)
    try {
      const rows = parseCSV(await file.text())
      let added = 0

      for (const row of rows) {
        if (!row.ign) continue
        await saveRow('players', {
          ign: row.ign,
          real_name: row.real_name || null,
          character_id: row.character_id || null,
          primary_role: row.primary_role || 'filler',
          secondary_role: row.secondary_role || null,
          status: row.status || 'active',
          device: row.device || null,
          bio: row.bio || null,
        })
        added += 1
      }

      await data.reload()
      toast.success(`${added} players imported`)
    } catch (err) {
      toast.error(readableError(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader title="Export" icon={Download} subtitle="Everything stays on your device" />

        <Button className="mb-4" onClick={exportEverything}>
          <Download size={15} /> Download full JSON backup
        </Button>

        <p className="label mb-2">Individual tables (CSV)</p>
        <div className="flex flex-wrap gap-2">
          {EXPORTABLE_TABLES.map((table) => (
            <Button
              key={table.key}
              size="sm"
              variant="secondary"
              onClick={() => exportTable(table.key, table.label)}
            >
              {table.label}
              <span className="ml-1 text-faint">({(data[table.key] || []).length})</span>
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Import players" icon={Upload} />
        <Alert tone="warn" className="mb-3">
          The CSV needs an <code>ign</code> column. Optional columns:{' '}
          <code>real_name, character_id, primary_role, secondary_role, status, device, bio</code>.
          Export the players table first to see the exact format.
        </Alert>
        <FileInput
          label="Players CSV"
          accept=".csv,text/csv"
          disabled={importing}
          onFile={importPlayers}
        />
        {importing && <p className="mt-2 text-sm text-muted">Importing…</p>}
      </Card>
    </>
  )
}

/* ===========================================================================
 * 7. ACTIVITY LOG
 * ========================================================================= */
function ActivitySection() {
  const { activity, reload } = useData()
  const confirm = useConfirm()

  const columns = [
    {
      key: 'created_at',
      label: 'When',
      value: (r) => new Date(r.created_at).getTime(),
      render: (r) => <span className="whitespace-nowrap text-muted">{dateTime(r.created_at)}</span>,
    },
    { key: 'actor_name', label: 'Who', render: (r) => r.actor_name || 'System' },
    {
      key: 'action',
      label: 'Action',
      render: (r) => (
        <Badge
          size="sm"
          color={
            r.action === 'delete' ? '#ef4444' : r.action === 'insert' ? '#22c55e' : '#38bdf8'
          }
        >
          {r.action}
        </Badge>
      ),
    },
    { key: 'entity', label: 'Table', hideOnMobile: true },
    {
      key: 'summary',
      label: 'What',
      render: (r) => <span className="text-muted">{r.summary}</span>,
    },
  ]

  async function clearOld() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    try {
      await clearActivity(cutoff)
      await reload()
      toast.success('Entries older than 30 days cleared')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Activity log"
          icon={Activity}
          subtitle="Who added, edited or deleted what"
          action={
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                confirm.ask({
                  title: 'Clear old entries?',
                  message: 'Everything older than 30 days will be deleted from the log.',
                  confirmLabel: 'Clear',
                  onConfirm: clearOld,
                })
              }
            >
              <Trash2 size={13} /> Clear 30+ days
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={activity}
          initialSort={{ key: 'created_at', dir: 'desc' }}
          pageSize={25}
          dense
        />
      </Card>
      <confirm.Dialog />
    </>
  )
}

/* ===========================================================================
 * PAGE
 * ========================================================================= */
export default function Settings() {
  const [section, setSection] = useState('team')

  return (
    <>
      <PageHeader title="Settings" subtitle="Owner and Admin only" />

      <Tabs
        tabs={SECTIONS.map((s) => ({ value: s.value, label: s.label }))}
        value={section}
        onChange={setSection}
        className="mb-4"
      />

      {section === 'team' && <TeamSection />}
      {section === 'totals' && <TotalsSection />}
      {section === 'users' && <UsersSection />}
      {section === 'maps' && <MapsSection />}
      {section === 'scoring' && <ScoringSection />}
      {section === 'data' && <DataSection />}
      {section === 'activity' && <ActivitySection />}
    </>
  )
}
