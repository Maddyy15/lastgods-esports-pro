/**
 * One match in full: the result, the context around it, every player's line,
 * the coach's notes and the VOD.
 */
import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Video,
  Image as ImageIcon,
  Crown,
  MapPin,
  Users,
  Swords,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { deleteMatch } from '@/lib/api'
import { readableError } from '@/lib/supabase'
import { dateTime, num, ordinal, duration, humanize } from '@/lib/format'

import { Button, Card, CardHeader, PageHeader, EmptyState } from '@/components/ui/Primitives'
import { StatBox, StatGrid, InfoRow } from '@/components/ui/StatBox'
import { MatchTypeBadge } from '@/components/ui/Chips'
import { Avatar } from '@/components/ui/Avatar'
import { DataTable } from '@/components/ui/DataTable'
import { useConfirm } from '@/components/ui/Modal'
import MatchForm from '@/components/matches/MatchForm'

export default function MatchDetail() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const { matches, statsIndex, playerById, mapName, spotName, tournamentName, reload } =
    useData()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)

  const match = matches.find((m) => m.id === matchId)
  const rows = useMemo(() => statsIndex.byMatch.get(matchId) || [], [statsIndex, matchId])

  if (!match) {
    return (
      <EmptyState
        icon={Swords}
        title="Match not found"
        message="It may have been deleted."
        action={
          <Link to="/matches">
            <Button>Back to matches</Button>
          </Link>
        }
      />
    )
  }

  const eventName = tournamentName(match.tournament_id) || match.scrim_name || 'Scrim'

  async function handleDelete() {
    try {
      await deleteMatch(match.id)
      await reload()
      toast.success('Match deleted — all totals recalculated')
      navigate('/matches')
    } catch (err) {
      toast.error(readableError(err))
    }
  }

  const columns = [
    {
      key: 'player',
      label: 'Player',
      value: (r) => playerById.get(r.player_id)?.ign || '',
      render: (r) => {
        const player = playerById.get(r.player_id)
        if (!player) return <span className="text-faint">Removed player</span>
        return (
          <Link
            to={`/players/${player.id}`}
            className="flex items-center gap-2 transition-colors hover:text-accent"
          >
            <Avatar src={player.photo_url} name={player.ign} role={player.primary_role} size="xs" />
            <span className="whitespace-nowrap font-medium">{player.ign}</span>
            {r.is_mvp && <Crown size={13} className="text-accent" />}
          </Link>
        )
      },
    },
    { key: 'finishes', label: 'Finishes', align: 'right' },
    { key: 'knocks', label: 'Knocks', align: 'right', hideOnMobile: true },
    { key: 'assists', label: 'Assists', align: 'right', hideOnMobile: true },
    {
      key: 'damage',
      label: 'Damage',
      align: 'right',
      render: (r) => <span className="font-head font-semibold">{num(r.damage)}</span>,
    },
    { key: 'headshots', label: 'HS', align: 'right', hideOnMobile: true },
    { key: 'revives', label: 'Revives', align: 'right', hideOnMobile: true },
    {
      key: 'survival_seconds',
      label: 'Survived',
      align: 'right',
      render: (r) => <span className="text-muted">{duration(r.survival_seconds)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'longest_kill',
      label: 'Longest',
      align: 'right',
      render: (r) => <span className="text-muted">{num(r.longest_kill)}m</span>,
      hideOnMobile: true,
    },
  ]

  return (
    <>
      <Link
        to="/matches"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} /> All matches
      </Link>

      <PageHeader
        title={`${mapName(match.map_id)} · ${ordinal(match.placement)}`}
        subtitle={`${eventName}${match.stage ? ` · ${match.stage}` : ''}${
          match.match_number ? ` · Match ${match.match_number}` : ''
        } · ${dateTime(match.played_at)}`}
      >
        {can.editMatches && (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                confirm.ask({
                  title: 'Delete this match?',
                  message:
                    'Every player stat from this match goes with it, and all team totals, map records and leaderboards will be recalculated.',
                  onConfirm: handleDelete,
                })
              }
            >
              <Trash2 size={15} /> Delete
            </Button>
          </>
        )}
      </PageHeader>

      {/* Headline numbers */}
      <StatGrid cols={5} className="mb-4">
        <StatBox
          label="Placement"
          value={ordinal(match.placement)}
          animate={false}
          color={match.placement === 1 ? '#f59e0b' : undefined}
          hint={`of ${match.teams_in_lobby} teams`}
        />
        <StatBox label="Placement pts" value={match.placement_points} />
        <StatBox label="Finish pts" value={match.finish_points} />
        <StatBox label="Total points" value={match.total_points} color="var(--color-accent)" />
        <StatBox label="Team damage" value={match.team_damage} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------- scoresheet --- */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Scoresheet"
              icon={Users}
              subtitle={`${rows.length} players played this match`}
            />
            <DataTable
              columns={columns}
              rows={rows}
              initialSort={{ key: 'damage', dir: 'desc' }}
              pageSize={0}
              dense
            />
          </Card>

          {match.coach_notes && (
            <Card>
              <CardHeader title="Coach's notes" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {match.coach_notes}
              </p>
            </Card>
          )}

          {match.screenshot_url && (
            <Card>
              <CardHeader title="Result screenshot" icon={ImageIcon} />
              <a href={match.screenshot_url} target="_blank" rel="noreferrer">
                <img
                  src={match.screenshot_url}
                  alt="Match result"
                  className="w-full rounded-xl border border-line"
                />
              </a>
            </Card>
          )}
        </div>

        {/* ----------------------------------------------------- context --- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Match context" icon={MapPin} />
            <div className="divide-y divide-line">
              <InfoRow label="Map" value={mapName(match.map_id)} />
              <InfoRow
                label="Drop spot"
                value={match.drop_spot_id ? spotName(match.drop_spot_id) : '—'}
              />
              <InfoRow
                label="Contested"
                value={
                  match.contested ? (
                    <span className="text-warn">
                      Yes{match.contested_against ? ` · ${match.contested_against}` : ''}
                    </span>
                  ) : (
                    'No'
                  )
                }
              />
              <InfoRow label="First circle" value={match.zone_side || '—'} />
              <InfoRow label="Rotation" value={match.rotation_timing || '—'} />
              <InfoRow label="Eliminated by" value={match.eliminated_by || '—'} />
              <InfoRow
                label="Eliminated in"
                value={match.eliminated_phase ? humanize(match.eliminated_phase) : '—'}
              />
              <InfoRow
                label="Type"
                value={<MatchTypeBadge type={match.match_type} size="sm" />}
              />
              {match.tournament_id && (
                <InfoRow
                  label="Tournament"
                  value={
                    <Link
                      to={`/tournaments/${match.tournament_id}`}
                      className="text-accent hover:underline"
                    >
                      {tournamentName(match.tournament_id)}
                    </Link>
                  }
                />
              )}
              {match.day_number && <InfoRow label="Day" value={match.day_number} />}
            </div>
          </Card>

          {match.vod_url && (
            <a href={match.vod_url} target="_blank" rel="noreferrer" className="block">
              <Card hover className="flex items-center gap-3">
                <Video size={22} className="text-bad" />
                <div>
                  <p className="font-head font-semibold text-fg">Watch the VOD</p>
                  <p className="text-xs text-muted">Opens in a new tab</p>
                </div>
              </Card>
            </a>
          )}

          {/* Quick team summary */}
          <Card>
            <CardHeader title="Team summary" />
            <div className="divide-y divide-line">
              <InfoRow label="Finishes" value={match.team_finishes} />
              <InfoRow label="Damage" value={num(match.team_damage)} />
              <InfoRow
                label="Damage per kill"
                value={
                  match.team_finishes
                    ? num(match.team_damage / match.team_finishes, 0)
                    : '—'
                }
              />
              <InfoRow
                label="MVP"
                value={
                  rows.find((r) => r.is_mvp)
                    ? playerById.get(rows.find((r) => r.is_mvp).player_id)?.ign
                    : '—'
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {editing && (
        <MatchForm
          open
          match={match}
          existingStats={rows}
          onClose={() => setEditing(false)}
        />
      )}
      <confirm.Dialog />
    </>
  )
}
