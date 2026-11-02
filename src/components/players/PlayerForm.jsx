/**
 * Add / edit a player.
 *
 * The same form serves two people:
 *   • an Admin, who can change everything
 *   • a Player editing their own card, who can change their photo, device,
 *     sensitivity, weapons, bio and socials — but NOT their IGN, roles or
 *     roster status. Those fields are disabled, and the database refuses the
 *     change too (see guard_player_changes in 01_schema.sql).
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Upload } from 'lucide-react'
import { saveRow, uploadFile } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { GAME_ROLE_OPTIONS, PLAYER_STATUS_OPTIONS } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Button, Alert } from '@/components/ui/Primitives'
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

export default function PlayerForm({ open, onClose, player }) {
  const { isStaff, isAdmin } = useAuth()
  const { reload } = useData()

  const [form, setForm] = useState(() => ({ ...BLANK, ...(player || {}) }))
  const [photoFile, setPhotoFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const editing = Boolean(player?.id)
  // Identity fields are locked for anyone who is not staff
  const lockIdentity = editing && !isStaff

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setField = (key) => (e) => set(key)(e.target.value)
  const setSocial = (key) => (e) =>
    setForm((f) => ({ ...f, socials: { ...(f.socials || {}), [key]: e.target.value } }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.ign.trim()) {
      setError('An in-game name is required.')
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

      await saveRow('players', payload)
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

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? `Edit ${player.ign}` : 'Add player'}
      subtitle={
        lockIdentity
          ? 'You can update your own settings and profile details.'
          : 'Roster details, device setup and preferred weapons.'
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
      <form id="player-form" onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {/* ---------------------------------------------------- identity --- */}
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

        {/* ------------------------------------------------------- roles --- */}
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

        {/* ------------------------------------------------------ device --- */}
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

        {/* ------------------------------------------------------ socials --- */}
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
      </form>
    </Modal>
  )
}
