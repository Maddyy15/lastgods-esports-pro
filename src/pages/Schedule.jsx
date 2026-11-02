/**
 * Schedule & Attendance.
 *
 * Coaches add sessions; players tap Available / Maybe / Not available on their
 * own row. The attendance record at the bottom shows who actually turns up.
 */
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  CalendarDays,
  Pencil,
  Trash2,
  Save,
  Check,
  X,
  HelpCircle,
  History,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { saveRow, deleteRow, setAttendance } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { dateShort, timeOnly, toLocalInput, timeAgo, pct, cx } from '@/lib/format'
import { EVENT_TYPE_OPTIONS, ATTENDANCE_STATUS } from '@/lib/constants'

import { Button, Card, CardHeader, EmptyState, PageHeader, Tabs } from '@/components/ui/Primitives'
import { Modal, useConfirm } from '@/components/ui/Modal'
import { Input, Select, Textarea, FormGrid } from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Avatar'
import { EventTypeBadge } from '@/components/ui/Chips'
import { DataTable } from '@/components/ui/DataTable'

/* ---------------------------------------------------------------------------
 * ADD / EDIT EVENT
 * ------------------------------------------------------------------------- */
function EventForm({ open, onClose, event }) {
  const { reload, tournaments } = useData()
  const [form, setForm] = useState(() =>
    event
      ? {
          ...event,
          starts_at: toLocalInput(event.starts_at),
          ends_at: event.ends_at ? toLocalInput(event.ends_at) : '',
          tournament_id: event.tournament_id || '',
        }
      : {
          title: '',
          event_type: 'scrim',
          starts_at: toLocalInput(new Date()),
          ends_at: '',
          tournament_id: '',
          location: 'Custom room',
          notes: '',
        },
  )
  const [busy, setBusy] = useState(false)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Give the session a title.')

    setBusy(true)
    try {
      await saveRow('schedule_events', {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        tournament_id: form.tournament_id || null,
      })
      await reload()
      toast.success(event ? 'Session updated' : 'Session added')
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
      title={event ? 'Edit session' : 'Add session'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" loading={busy}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={setField('title')}
          placeholder="Pro Scrims League — Day 5"
        />
        <FormGrid>
          <Select
            label="Type"
            options={EVENT_TYPE_OPTIONS}
            value={form.event_type}
            onChange={setField('event_type')}
          />
          <Select
            label="Tournament"
            options={tournaments.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Not linked"
            value={form.tournament_id}
            onChange={setField('tournament_id')}
          />
          <Input
            label="Starts"
            type="datetime-local"
            required
            value={form.starts_at}
            onChange={setField('starts_at')}
          />
          <Input
            label="Ends"
            type="datetime-local"
            value={form.ends_at || ''}
            onChange={setField('ends_at')}
          />
        </FormGrid>
        <Input label="Where" value={form.location || ''} onChange={setField('location')} />
        <Textarea label="Notes" rows={3} value={form.notes || ''} onChange={setField('notes')} />
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * ONE AVAILABILITY BUTTON ROW
 * ------------------------------------------------------------------------- */
function AvailabilityRow({ event, player, current, canSet, onSet }) {
  const options = [
    { value: 'available', icon: Check, label: 'In' },
    { value: 'maybe', icon: HelpCircle, label: 'Maybe' },
    { value: 'not_available', icon: X, label: 'Out' },
  ]

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-2.5 py-1.5">
      <Avatar src={player.photo_url} name={player.ign} role={player.primary_role} size="xs" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{player.ign}</span>

      <div className="flex gap-1">
        {options.map((option) => {
          const active = current === option.value
          const color = ATTENDANCE_STATUS[option.value].color
          return (
            <button
              key={option.value}
              disabled={!canSet}
              onClick={() => onSet(event.id, player.id, option.value)}
              title={ATTENDANCE_STATUS[option.value].label}
              className={cx(
                'flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors',
                !canSet && 'cursor-not-allowed opacity-60',
              )}
              style={{
                color: active ? color : 'var(--color-faint)',
                borderColor: active ? `${color}66` : 'var(--color-line)',
                backgroundColor: active ? `${color}1f` : 'transparent',
              }}
            >
              <option.icon size={11} />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------------------- */
export default function Schedule() {
  const { can, myPlayerId, isStaff } = useAuth()
  const { events, attendance, players, activePlayers, reload, tournamentName } = useData()
  const confirm = useConfirm()

  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('upcoming')

  const now = Date.now()
  const { upcoming, past } = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    return {
      upcoming: sorted.filter((e) => new Date(e.starts_at).getTime() >= now - 3 * 3600000),
      past: sorted
        .filter((e) => new Date(e.starts_at).getTime() < now - 3 * 3600000)
        .reverse(),
    }
  }, [events, now])

  const shown = tab === 'upcoming' ? upcoming : past

  /** Attendance lookup: "eventId|playerId" -> status */
  const attendanceMap = useMemo(
    () => new Map(attendance.map((a) => [`${a.event_id}|${a.player_id}`, a.status])),
    [attendance],
  )

  /** Per-player attendance record across every past session. */
  const record = useMemo(
    () =>
      players
        .map((player) => {
          const rows = attendance.filter(
            (a) =>
              a.player_id === player.id &&
              past.some((e) => e.id === a.event_id),
          )
          const available = rows.filter((r) => r.status === 'available').length
          return {
            player,
            marked: rows.length,
            available,
            missed: rows.filter((r) => r.status === 'not_available').length,
            maybe: rows.filter((r) => r.status === 'maybe').length,
            rate: rows.length ? (available / rows.length) * 100 : 0,
          }
        })
        .filter((r) => r.marked > 0),
    [players, attendance, past],
  )

  async function mark(eventId, playerId, status) {
    try {
      await setAttendance(eventId, playerId, status)
      await reload()
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  async function handleDelete(event) {
    try {
      await deleteRow('schedule_events', event.id)
      await reload()
      toast.success('Session removed')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  const recordColumns = [
    {
      key: 'player',
      label: 'Player',
      value: (r) => r.player.ign,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.player.photo_url} name={r.player.ign} role={r.player.primary_role} size="xs" />
          <span className="whitespace-nowrap font-medium">{r.player.ign}</span>
        </div>
      ),
    },
    { key: 'marked', label: 'Sessions', align: 'right' },
    { key: 'available', label: 'Available', align: 'right' },
    { key: 'maybe', label: 'Maybe', align: 'right' },
    { key: 'missed', label: 'Missed', align: 'right' },
    {
      key: 'rate',
      label: 'Attendance',
      align: 'right',
      render: (r) => (
        <span
          className="font-head font-semibold"
          style={{ color: r.rate >= 80 ? '#22c55e' : r.rate >= 50 ? '#eab308' : '#ef4444' }}
        >
          {pct(r.rate, 0)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Schedule" subtitle="Scrims, tournaments and practice sessions">
        {can.editSchedule && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={15} /> Add session
          </Button>
        )}
      </PageHeader>

      <Tabs
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'past', label: 'Past', count: past.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4 max-w-xs"
      />

      {!shown.length ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === 'upcoming' ? 'Nothing scheduled' : 'No past sessions'}
          message={
            tab === 'upcoming'
              ? 'Add your next scrim block so everyone can mark whether they are available.'
              : 'Past sessions will appear here once they are done.'
          }
          action={
            tab === 'upcoming' &&
            can.editSchedule && (
              <Button onClick={() => setEditing('new')}>
                <Plus size={15} /> Add session
              </Button>
            )
          }
        />
      ) : (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          {shown.map((event) => {
            const roster = activePlayers.length ? activePlayers : players
            const counts = roster.reduce(
              (acc, player) => {
                const status = attendanceMap.get(`${event.id}|${player.id}`)
                if (status) acc[status] = (acc[status] || 0) + 1
                else acc.unmarked += 1
                return acc
              },
              { unmarked: 0 },
            )

            return (
              <Card key={event.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-head text-lg font-semibold text-fg">{event.title}</h3>
                    <p className="text-xs text-muted">
                      {dateShort(event.starts_at)} · {timeOnly(event.starts_at)}
                      {event.ends_at && ` — ${timeOnly(event.ends_at)}`}
                      {event.location && ` · ${event.location}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <EventTypeBadge type={event.event_type} size="sm" />
                      {event.tournament_id && (
                        <span className="text-[11px] text-accent">
                          {tournamentName(event.tournament_id)}
                        </span>
                      )}
                      <span className="text-[11px] text-faint">{timeAgo(event.starts_at)}</span>
                    </div>
                  </div>

                  {can.editSchedule && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(event)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() =>
                          confirm.ask({
                            title: 'Delete this session?',
                            message: 'Everyone’s availability for it will be removed too.',
                            onConfirm: () => handleDelete(event),
                          })
                        }
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {event.notes && (
                  <p className="mt-2 rounded-lg border border-line bg-ink/50 p-2.5 text-sm text-muted">
                    {event.notes}
                  </p>
                )}

                {/* Availability */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="label">Availability</p>
                    <p className="text-[11px] text-faint">
                      <span className="text-win">{counts.available || 0} in</span> ·{' '}
                      <span className="text-warn">{counts.maybe || 0} maybe</span> ·{' '}
                      <span className="text-bad">{counts.not_available || 0} out</span>
                      {counts.unmarked > 0 && ` · ${counts.unmarked} no answer`}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {roster.map((player) => (
                      <AvailabilityRow
                        key={player.id}
                        event={event}
                        player={player}
                        current={attendanceMap.get(`${event.id}|${player.id}`)}
                        // Staff can set anyone's; a player can set only their own
                        canSet={isStaff || player.id === myPlayerId}
                        onSet={mark}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {record.length > 0 && (
        <Card>
          <CardHeader
            title="Attendance record"
            subtitle="Across every past session"
            icon={History}
          />
          <DataTable
            columns={recordColumns}
            rows={record}
            initialSort={{ key: 'rate', dir: 'desc' }}
            pageSize={0}
            rowKey={(r) => r.player.id}
            dense
          />
        </Card>
      )}

      {editing && (
        <EventForm open event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      <confirm.Dialog />
    </>
  )
}
