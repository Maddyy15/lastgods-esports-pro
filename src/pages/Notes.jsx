/**
 * Strategy Notes & Announcements.
 *
 * Notes are per map: rotations, holds, mistakes to fix.
 * Announcements are the team board — pinned ones show on the dashboard.
 */
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Plus,
  NotebookPen,
  Megaphone,
  Pencil,
  Trash2,
  Save,
  Pin,
  PinOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { saveRow, deleteRow } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { timeAgo, dateTime, cx } from '@/lib/format'

import { Button, Card, EmptyState, PageHeader, Tabs, Badge } from '@/components/ui/Primitives'
import { Modal, useConfirm } from '@/components/ui/Modal'
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Form'

/* ---------------------------------------------------------------------------
 * STRATEGY NOTE FORM
 * ------------------------------------------------------------------------- */
function NoteForm({ open, onClose, note }) {
  const { reload, maps, profiles } = useData()
  const { user } = useAuth()

  const [form, setForm] = useState(
    () =>
      note || {
        title: '',
        body: '',
        map_id: '',
        tags: [],
        is_pinned: false,
      },
  )
  const [tagText, setTagText] = useState((note?.tags || []).join(', '))
  const [busy, setBusy] = useState(false)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Give the note a title.')

    setBusy(true)
    try {
      await saveRow('strategy_notes', {
        ...form,
        map_id: form.map_id || null,
        author_id: form.author_id || user?.id || null,
        tags: tagText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      await reload()
      toast.success(note ? 'Note updated' : 'Note added')
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
      title={note ? 'Edit note' : 'New strategy note'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="note-form" loading={busy}>
            <Save size={15} /> Save
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={setField('title')}
          placeholder="Erangel — Pochinki hold"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Map"
            options={maps.map((m) => ({ value: m.id, label: m.name }))}
            placeholder="Not map specific"
            value={form.map_id || ''}
            onChange={setField('map_id')}
          />
          <Input
            label="Tags"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="rotation, hold, drop"
            hint="Comma separated."
          />
        </div>
        <Textarea
          label="The plan"
          rows={10}
          value={form.body || ''}
          onChange={setField('body')}
          placeholder={'1. Who takes which building\n2. When we smoke\n3. When the IGL calls the rotate'}
        />
        <Checkbox
          label="Pin this note to the top"
          checked={form.is_pinned}
          onChange={(v) => setForm((f) => ({ ...f, is_pinned: v }))}
        />
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * ANNOUNCEMENT FORM
 * ------------------------------------------------------------------------- */
function AnnouncementForm({ open, onClose, announcement }) {
  const { reload } = useData()
  const { user } = useAuth()

  const [form, setForm] = useState(
    () => announcement || { title: '', body: '', is_pinned: false },
  )
  const [busy, setBusy] = useState(false)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Give the announcement a title.')

    setBusy(true)
    try {
      await saveRow('announcements', {
        ...form,
        author_id: form.author_id || user?.id || null,
      })
      await reload()
      toast.success(announcement ? 'Announcement updated' : 'Announcement posted')
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
      title={announcement ? 'Edit announcement' : 'New announcement'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="ann-form" loading={busy}>
            <Save size={15} /> Post
          </Button>
        </>
      }
    >
      <form id="ann-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" required value={form.title} onChange={setField('title')} />
        <Textarea label="Message" rows={6} value={form.body || ''} onChange={setField('body')} />
        <Checkbox
          label="Pin to the dashboard"
          hint="Pinned announcements appear on everyone's home screen."
          checked={form.is_pinned}
          onChange={(v) => setForm((f) => ({ ...f, is_pinned: v }))}
        />
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------------------- */
export default function Notes() {
  const { can } = useAuth()
  const { notes, announcements, maps, mapName, profiles, reload } = useData()
  const confirm = useConfirm()

  const [tab, setTab] = useState('notes')
  const [mapFilter, setMapFilter] = useState('all')
  const [editingNote, setEditingNote] = useState(null)
  const [editingAnn, setEditingAnn] = useState(null)

  const authorName = (id) => {
    const profile = profiles.find((p) => p.id === id)
    return profile?.full_name || profile?.email || 'Someone'
  }

  const visibleNotes = useMemo(() => {
    const list = mapFilter === 'all' ? notes : notes.filter((n) => n.map_id === mapFilter)
    return [...list].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
  }, [notes, mapFilter])

  const sortedAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)),
    [announcements],
  )

  async function togglePin(table, row) {
    try {
      await saveRow(table, { id: row.id, is_pinned: !row.is_pinned })
      await reload()
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  async function remove(table, row, label) {
    try {
      await deleteRow(table, row.id)
      await reload()
      toast.success(`${label} deleted`)
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  const mapTabs = [
    { value: 'all', label: 'All', count: notes.length },
    ...maps
      .map((m) => ({
        value: m.id,
        label: m.name,
        count: notes.filter((n) => n.map_id === m.id).length,
      }))
      .filter((t) => t.count > 0),
  ]

  return (
    <>
      <PageHeader title="Notes & Board" subtitle="Strategy plans and team announcements">
        {can.editNotes && (
          <Button
            onClick={() => (tab === 'notes' ? setEditingNote('new') : setEditingAnn('new'))}
          >
            <Plus size={15} /> {tab === 'notes' ? 'New note' : 'New announcement'}
          </Button>
        )}
      </PageHeader>

      <Tabs
        tabs={[
          { value: 'notes', label: 'Strategy notes', count: notes.length },
          { value: 'board', label: 'Announcements', count: announcements.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4 max-w-sm"
      />

      {tab === 'notes' ? (
        <>
          {notes.length > 0 && (
            <Tabs tabs={mapTabs} value={mapFilter} onChange={setMapFilter} className="mb-4" />
          )}

          {!visibleNotes.length ? (
            <EmptyState
              icon={NotebookPen}
              title="No strategy notes yet"
              message="Write down your rotations and holds for each map, so nobody has to remember the plan mid-match."
              action={
                can.editNotes && (
                  <Button onClick={() => setEditingNote('new')}>
                    <Plus size={15} /> Write your first note
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleNotes.map((note) => (
                <Card
                  key={note.id}
                  className={cx(note.is_pinned && 'border-accent/40 bg-accent/5')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-head text-lg font-semibold text-fg">{note.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {note.map_id && (
                          <Badge color="#38bdf8" size="sm">
                            {mapName(note.map_id)}
                          </Badge>
                        )}
                        {(note.tags || []).map((tag) => (
                          <Badge key={tag} color="#8d95a6" size="sm">
                            {tag}
                          </Badge>
                        ))}
                        {note.is_pinned && (
                          <Badge color="#f59e0b" size="sm">
                            Pinned
                          </Badge>
                        )}
                      </div>
                    </div>

                    {can.editNotes && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => togglePin('strategy_notes', note)}
                          title={note.is_pinned ? 'Unpin' : 'Pin'}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                        >
                          {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingNote(note)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() =>
                            confirm.ask({
                              title: `Delete "${note.title}"?`,
                              onConfirm: () => remove('strategy_notes', note, 'Note'),
                            })
                          }
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {note.body}
                  </p>

                  <p className="mt-3 border-t border-line pt-2 text-[11px] text-faint">
                    {authorName(note.author_id)} · {timeAgo(note.updated_at || note.created_at)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {!sortedAnnouncements.length ? (
            <EmptyState
              icon={Megaphone}
              title="The board is empty"
              message="Post timings, reminders and anything the squad needs to read before the next session."
              action={
                can.editNotes && (
                  <Button onClick={() => setEditingAnn('new')}>
                    <Plus size={15} /> Post an announcement
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {sortedAnnouncements.map((item) => (
                <Card
                  key={item.id}
                  className={cx(item.is_pinned && 'border-accent/40 bg-accent/5')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-head text-lg font-semibold text-fg">
                        {item.is_pinned && <Pin size={14} className="text-accent" />}
                        {item.title}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {item.body}
                      </p>
                      <p className="mt-3 text-[11px] text-faint">
                        {authorName(item.author_id)} · {dateTime(item.created_at)}
                      </p>
                    </div>

                    {can.editNotes && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => togglePin('announcements', item)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                        >
                          {item.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingAnn(item)}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() =>
                            confirm.ask({
                              title: `Delete "${item.title}"?`,
                              onConfirm: () =>
                                remove('announcements', item, 'Announcement'),
                            })
                          }
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {editingNote && (
        <NoteForm
          open
          note={editingNote === 'new' ? null : editingNote}
          onClose={() => setEditingNote(null)}
        />
      )}
      {editingAnn && (
        <AnnouncementForm
          open
          announcement={editingAnn === 'new' ? null : editingAnn}
          onClose={() => setEditingAnn(null)}
        />
      )}
      <confirm.Dialog />
    </>
  )
}
