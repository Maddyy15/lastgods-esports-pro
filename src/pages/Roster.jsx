/**
 * Roster — a card for every player, with their current form and headline
 * stats. Click a card to open the full player profile.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { deleteRow } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import {
  aggregateForPlayer,
  derivePlayerStats,
  playerFormStrip,
  playerRating,
} from '@/lib/stats'
import { PLAYER_STATUS } from '@/lib/constants'
import { num, pct } from '@/lib/format'

import { Button, Card, EmptyState, PageHeader, Tabs, ProgressBar } from '@/components/ui/Primitives'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadges, StatusBadge, FormStrip } from '@/components/ui/Chips'
import { MiniStat } from '@/components/ui/StatBox'
import { useConfirm } from '@/components/ui/Modal'
import PlayerForm from '@/components/players/PlayerForm'

export default function Roster() {
  const { can, myPlayerId, isAdmin } = useAuth()
  const { players, matches, statsIndex, settings, reload } = useData()
  const confirm = useConfirm()

  const [editing, setEditing] = useState(null) // player object or 'new'
  const [filter, setFilter] = useState('all')

  const teamFinishes = useMemo(
    () => matches.reduce((a, m) => a + (m.team_finishes || 0), 0),
    [matches],
  )

  /** Every player with their stats attached, ready to render. */
  const cards = useMemo(
    () =>
      players.map((player) => {
        const totals = aggregateForPlayer(player.id, matches, statsIndex)
        const derived = derivePlayerStats(totals, teamFinishes)
        return {
          player,
          derived,
          rating: playerRating(derived, settings.rating_weights),
          form: playerFormStrip(player.id, matches, statsIndex, 5),
        }
      }),
    [players, matches, statsIndex, teamFinishes, settings.rating_weights],
  )

  const visible = filter === 'all' ? cards : cards.filter((c) => c.player.status === filter)

  const tabs = [
    { value: 'all', label: 'All', count: cards.length },
    ...Object.entries(PLAYER_STATUS).map(([value, meta]) => ({
      value,
      label: meta.label,
      count: cards.filter((c) => c.player.status === value).length,
    })),
  ].filter((t) => t.count > 0 || t.value === 'all')

  async function handleDelete(player) {
    try {
      await deleteRow('players', player.id)
      await reload()
      toast.success(`${player.ign} removed from the roster`)
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  return (
    <>
      <PageHeader title="Roster" subtitle={`${players.length} players on the books`}>
        {can.editPlayers && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={15} /> Add player
          </Button>
        )}
      </PageHeader>

      {cards.length > 1 && (
        <Tabs tabs={tabs} value={filter} onChange={setFilter} className="mb-4 max-w-md" />
      )}

      {!visible.length ? (
        <EmptyState
          icon={Users}
          title="No players yet"
          message="Add your line-up and every match you log will start building their stats."
          action={
            can.editPlayers && (
              <Button onClick={() => setEditing('new')}>
                <Plus size={15} /> Add your first player
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ player, derived, rating, form }, i) => {
            // A player may edit their own card even without staff rights
            const canEditThis = can.editPlayers || player.id === myPlayerId

            return (
              <Card
                key={player.id}
                hover
                className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                {/* Header: photo, name, roles */}
                <div className="flex items-start gap-3">
                  <Link to={`/players/${player.id}`} className="shrink-0">
                    <Avatar
                      src={player.photo_url}
                      name={player.ign}
                      role={player.primary_role}
                      size="md"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/players/${player.id}`}
                      className="block truncate font-head text-lg font-semibold text-fg transition-colors hover:text-accent"
                    >
                      {player.ign}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {player.real_name || 'Name not set'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <RoleBadges
                        primary={player.primary_role}
                        secondary={player.secondary_role}
                        size="sm"
                      />
                      <StatusBadge status={player.status} size="sm" />
                    </div>
                  </div>

                  {canEditThis && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(player)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-accent focus-accent"
                      >
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            confirm.ask({
                              title: `Remove ${player.ign}?`,
                              message:
                                'Their match stats will be deleted too, and every total will be recalculated. This cannot be undone.',
                              confirmLabel: 'Remove player',
                              onConfirm: () => handleDelete(player),
                            })
                          }
                          title="Delete"
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bad/15 hover:text-bad focus-accent"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Rating bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="label">Player rating</span>
                    <span className="num text-xl text-accent">{rating}</span>
                  </div>
                  <ProgressBar value={rating} />
                </div>

                {/* Headline stats */}
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <MiniStat label="Matches" value={derived.matches} />
                  <MiniStat label="Finishes" value={num(derived.finishes)} />
                  <MiniStat label="K/D" value={derived.kd.toFixed(2)} />
                  <MiniStat label="Avg Dmg" value={num(derived.avgDamage)} />
                </div>

                {/* Recent form */}
                <div className="mt-3">
                  <p className="label mb-1.5">Last 5</p>
                  <FormStrip items={form} size="sm" />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px] text-faint">
                  <span>HS {pct(derived.headshotPct, 1)}</span>
                  <span>{derived.mvps} MVP</span>
                  <Link
                    to={`/players/${player.id}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Full profile →
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <PlayerForm
          open
          player={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <confirm.Dialog />
    </>
  )
}
