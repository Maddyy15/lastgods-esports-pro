/**
 * Player profile — everything we know about one player.
 *
 * The important part is the MAP-WISE BREAKDOWN: because every stat is
 * recalculated from the raw match rows, we can show exactly how this player
 * performs on each map individually, and point out their best and weakest one.
 */
import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Smartphone,
  Crosshair,
  AtSign,
  Video,
  Trophy,
  TrendingUp,
  TrendingDown,
  Medal,
  User,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import {
  aggregateForPlayer,
  derivePlayerStats,
  playerRating,
  radarProfile,
  playerByMap,
  playerTrend,
  playerFormStrip,
  filterMatches,
} from '@/lib/stats'
import { num, pct, duration, dateShort, ordinal, minutes } from '@/lib/format'
import { MATCH_TYPES } from '@/lib/constants'

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  Tabs,
} from '@/components/ui/Primitives'
import { StatBox, StatGrid, MiniStat, InfoRow } from '@/components/ui/StatBox'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadges, StatusBadge, FormStrip, PlacementChip } from '@/components/ui/Chips'
import { DataTable } from '@/components/ui/DataTable'
import { TrendLine, BarCompare, SkillRadar, SERIES } from '@/components/ui/Charts'
import PlayerForm from '@/components/players/PlayerForm'

export default function PlayerProfile() {
  const { playerId } = useParams()
  const { can, myPlayerId } = useAuth()
  const { players, matches, maps, statsIndex, settings, mapName, spotName } = useData()

  const [editing, setEditing] = useState(false)
  const [mapFilter, setMapFilter] = useState('all')

  const player = players.find((p) => p.id === playerId)

  /* ----------------------------------------------------- all the numbers */
  const data = useMemo(() => {
    if (!player) return null

    const teamFinishes = matches.reduce((a, m) => a + (m.team_finishes || 0), 0)
    const totals = aggregateForPlayer(player.id, matches, statsIndex)
    const derived = derivePlayerStats(totals, teamFinishes)

    // Per-map rows, then the best and weakest map by K/D
    const byMap = playerByMap(player.id, matches, statsIndex, maps)
    const ranked = [...byMap].filter((r) => r.matches >= 2).sort((a, b) => b.kd - a.kd)

    // Scrims vs Tournaments vs Practice vs Ranked
    const byType = Object.keys(MATCH_TYPES)
      .map((type) => {
        const subset = matches.filter((m) => m.match_type === type)
        const t = aggregateForPlayer(player.id, subset, statsIndex)
        const teamF = subset.reduce((a, m) => a + (m.team_finishes || 0), 0)
        return { type, label: MATCH_TYPES[type].label, ...derivePlayerStats(t, teamF) }
      })
      .filter((r) => r.matches > 0)

    // Personal bests
    const myRows = (statsIndex.byPlayer.get(player.id) || []).filter((r) =>
      matches.some((m) => m.id === r.match_id),
    )
    const bestBy = (key) =>
      myRows.reduce((best, r) => (!best || Number(r[key]) > Number(best[key]) ? r : best), null)

    return {
      totals,
      derived,
      rating: playerRating(derived, settings.rating_weights),
      radar: radarProfile(derived).map((r) => ({ axis: r.axis, value: r.value })),
      byMap,
      bestMap: ranked[0] || null,
      weakestMap: ranked.length > 1 ? ranked[ranked.length - 1] : null,
      byType,
      trend: playerTrend(player.id, matches, statsIndex, 20),
      form: playerFormStrip(player.id, matches, statsIndex, 10),
      records: {
        kills: bestBy('finishes'),
        damage: bestBy('damage'),
        longest: bestBy('longest_kill'),
      },
    }
  }, [player, matches, maps, statsIndex, settings.rating_weights])

  /* ------------------------------------------- this player's match history */
  const history = useMemo(() => {
    if (!player) return []
    const subset = filterMatches(matches, { mapId: mapFilter, playerId: player.id }, statsIndex)
    return subset
      .map((m) => {
        const row = (statsIndex.byMatch.get(m.id) || []).find(
          (r) => r.player_id === player.id,
        )
        return row ? { match: m, ...row } : null
      })
      .filter(Boolean)
  }, [player, matches, statsIndex, mapFilter])

  if (!player) {
    return (
      <EmptyState
        icon={User}
        title="Player not found"
        message="They may have been removed from the roster."
        action={
          <Link to="/roster">
            <Button>Back to roster</Button>
          </Link>
        }
      />
    )
  }

  const { derived, rating, byMap, bestMap, weakestMap, byType, trend, form, records } = data
  const canEdit = can.editPlayers || player.id === myPlayerId

  /* ------------------------------------------------------------- columns */
  const mapColumns = [
    { key: 'map', label: 'Map', value: (r) => r.map.name, render: (r) => (
      <Link to={`/maps/${r.map.id}`} className="font-medium text-fg hover:text-accent">
        {r.map.name}
      </Link>
    ) },
    { key: 'matches', label: 'Matches', align: 'right' },
    { key: 'finishes', label: 'Kills', align: 'right' },
    { key: 'knocks', label: 'Knocks', align: 'right', hideOnMobile: true },
    { key: 'damage', label: 'Damage', align: 'right', render: (r) => num(r.damage), hideOnMobile: true },
    { key: 'avgFinishes', label: 'Avg kills', align: 'right', render: (r) => r.avgFinishes.toFixed(2) },
    { key: 'avgDamage', label: 'Avg dmg', align: 'right', render: (r) => num(r.avgDamage) },
    {
      key: 'kd',
      label: 'K/D',
      align: 'right',
      render: (r) => <span className="font-head font-semibold text-accent">{r.kd.toFixed(2)}</span>,
    },
    { key: 'headshotPct', label: 'HS %', align: 'right', render: (r) => pct(r.headshotPct, 1), hideOnMobile: true },
    { key: 'mvps', label: 'MVPs', align: 'right', hideOnMobile: true },
    {
      key: 'best',
      label: 'Best match',
      align: 'right',
      sortable: false,
      hideOnMobile: true,
      render: (r) =>
        r.best ? (
          <Link to={`/matches/${r.best.match.id}`} className="text-muted hover:text-accent">
            {r.best.row.finishes} kills · {num(r.best.row.damage)} dmg
          </Link>
        ) : (
          '—'
        ),
    },
  ]

  const historyColumns = [
    {
      key: 'date',
      label: 'Date',
      value: (r) => new Date(r.match.played_at).getTime(),
      render: (r) => (
        <Link to={`/matches/${r.match.id}`} className="whitespace-nowrap text-muted hover:text-accent">
          {dateShort(r.match.played_at)}
        </Link>
      ),
    },
    {
      key: 'placement',
      label: 'Place',
      align: 'center',
      value: (r) => r.match.placement,
      render: (r) => <PlacementChip placement={r.match.placement} size="sm" />,
    },
    { key: 'map', label: 'Map', value: (r) => mapName(r.match.map_id), render: (r) => mapName(r.match.map_id) },
    {
      key: 'spot',
      label: 'Drop',
      value: (r) => (r.match.drop_spot_id ? spotName(r.match.drop_spot_id) : ''),
      render: (r) => (r.match.drop_spot_id ? spotName(r.match.drop_spot_id) : '—'),
      hideOnMobile: true,
    },
    { key: 'finishes', label: 'Kills', align: 'right' },
    { key: 'knocks', label: 'Knocks', align: 'right', hideOnMobile: true },
    { key: 'assists', label: 'Assists', align: 'right', hideOnMobile: true },
    { key: 'damage', label: 'Damage', align: 'right', render: (r) => num(r.damage) },
    {
      key: 'survival_seconds',
      label: 'Survived',
      align: 'right',
      render: (r) => duration(r.survival_seconds),
      hideOnMobile: true,
    },
    {
      key: 'is_mvp',
      label: 'MVP',
      align: 'center',
      render: (r) => (r.is_mvp ? <Trophy size={14} className="mx-auto text-accent" /> : '—'),
      hideOnMobile: true,
    },
  ]

  return (
    <>
      <Link
        to="/roster"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} /> Roster
      </Link>

      {/* ------------------------------------------------------- header --- */}
      <Card glow className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar
            src={player.photo_url}
            name={player.ign}
            role={player.primary_role}
            size="xl"
          />

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl leading-none font-semibold uppercase tracking-wide text-fg">
              {player.ign}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {player.real_name || 'Name not set'}
              {player.character_id && ` · ID ${player.character_id}`}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RoleBadges primary={player.primary_role} secondary={player.secondary_role} />
              <StatusBadge status={player.status} />
              {player.join_date && (
                <span className="text-xs text-faint">
                  Joined {dateShort(player.join_date)}
                </span>
              )}
            </div>

            {player.bio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{player.bio}</p>
            )}

            <div className="mt-3">
              <p className="label mb-1.5">Last 10 matches</p>
              <FormStrip items={form} size="sm" />
            </div>
          </div>

          {/* Rating dial */}
          <div className="w-full shrink-0 sm:w-44">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-center">
              <p className="label">Player rating</p>
              <p className="num text-5xl text-accent">{rating}</p>
              <ProgressBar value={rating} className="mt-2" />
              <p className="mt-1.5 text-[10px] text-faint">
                Weighted score out of 100. Adjust the weights in Settings.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                className="mt-2 w-full justify-center"
                onClick={() => setEditing(true)}
              >
                <Pencil size={14} /> Edit profile
              </Button>
            )}
          </div>
        </div>
      </Card>

      {derived.matches === 0 ? (
        <EmptyState
          icon={Trophy}
          title={`${player.ign} has no matches yet`}
          message="Once they play a logged match, every stat on this page fills in automatically."
          action={
            <Link to="/matches">
              <Button>Go to matches</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* -------------------------------------------- overall stats --- */}
          <h2 className="label mb-2">Overall</h2>
          <StatGrid cols={6} className="mb-4">
            <StatBox label="Matches" value={derived.matches} />
            <StatBox label="Finishes" value={derived.finishes} color="var(--color-accent)" />
            <StatBox label="Knocks" value={derived.knocks} />
            <StatBox label="Assists" value={derived.assists} />
            <StatBox label="Damage" value={derived.damage} />
            <StatBox label="Headshots" value={derived.headshots} />
            <StatBox label="Revives" value={derived.revives} />
            <StatBox label="MVPs" value={derived.mvps} color="#f59e0b" />
            <StatBox label="Chicken Dinners" value={derived.wwcd} color="#f59e0b" />
            <StatBox label="Top 10s" value={derived.top10} />
            <StatBox
              label="Survival time"
              value={minutes(derived.survival_seconds, 0)}
              suffix=" min"
              animate={false}
            />
            <StatBox label="Longest kill" value={derived.longest_kill} suffix=" m" />
          </StatGrid>

          {/* ------------------------------------------- calculated stats --- */}
          <h2 className="label mb-2">Calculated</h2>
          <StatGrid cols={6} className="mb-4">
            <StatBox label="K/D" value={derived.kd} decimals={2} color="var(--color-accent)" hint="Finishes per match" />
            <StatBox label="Avg damage" value={derived.avgDamage} />
            <StatBox label="Kills / match" value={derived.avgFinishes} decimals={2} />
            <StatBox label="Headshot %" value={derived.headshotPct} decimals={1} suffix="%" />
            <StatBox label="Damage per kill" value={derived.damagePerKill} />
            <StatBox
              label="Knock → finish"
              value={derived.knockConversion}
              decimals={1}
              suffix="%"
              hint="How often a knock becomes a kill"
            />
            <StatBox
              label="Kill contribution"
              value={derived.contributionPct}
              decimals={1}
              suffix="%"
              hint="Share of all team finishes"
            />
            <StatBox
              label="Avg survival"
              value={Number(minutes(derived.avgSurvival, 1))}
              decimals={1}
              suffix=" min"
            />
            <StatBox label="Avg placement" value={derived.avgPlacement} decimals={2} />
            <StatBox label="Win rate" value={derived.winRate} decimals={1} suffix="%" />
            <StatBox label="Avg assists" value={derived.avgAssists} decimals={2} />
            <StatBox label="Avg revives" value={derived.avgRevives} decimals={2} />
          </StatGrid>

          {/* ------------------------------------------------- advanced --- */}
          <h2 className="label mb-2">Advanced & utility</h2>
          <StatGrid cols={6} className="mb-4">
            <StatBox label="Throwable damage" value={derived.throwable_damage} />
            <StatBox label="Utility used" value={derived.utility_used} hint="Smokes, nades, molotovs" />
            <StatBox label="Vehicle kills" value={derived.vehicle_kills} />
            <StatBox label="Heals used" value={derived.heals_used} />
            <StatBox label="Boosts used" value={derived.boosts_used} />
            <StatBox label="Utility / match" value={derived.avgUtility} decimals={1} />
          </StatGrid>

          {/* ----------------------------------------------- charts row --- */}
          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            {/* Two separate charts on purpose: kills and damage are on
                completely different scales and must not share one axis. */}
            <TrendLine
              title="Finishes — last 20 matches"
              data={trend}
              series={[{ key: 'finishes', label: 'Finishes' }]}
              height={230}
            />
            <TrendLine
              title="Damage — last 20 matches"
              data={trend}
              series={[{ key: 'damage', label: 'Damage', color: SERIES[1] }]}
              height={230}
            />
            <SkillRadar
              title="Skill profile"
              subtitle="Each axis scored against an elite benchmark"
              data={data.radar}
              series={[{ key: 'value', label: player.ign }]}
              height={230}
            />
          </div>

          {/* --------------------------------------- MAP-WISE BREAKDOWN --- */}
          <Card className="mb-4">
            <CardHeader
              title="Map-wise breakdown"
              subtitle="How this player performs on each map individually"
              icon={Crosshair}
            />

            {/* Best / weakest highlight */}
            {(bestMap || weakestMap) && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {bestMap && (
                  <div className="rounded-xl border border-win/40 bg-win/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-win">
                      <TrendingUp size={14} /> Best map
                    </p>
                    <p className="font-display text-3xl font-semibold uppercase text-fg">
                      {bestMap.map.name}
                    </p>
                    <p className="text-xs text-muted">
                      {bestMap.kd.toFixed(2)} K/D · {num(bestMap.avgDamage)} avg damage ·{' '}
                      {bestMap.matches} matches
                    </p>
                  </div>
                )}
                {weakestMap && (
                  <div className="rounded-xl border border-bad/40 bg-bad/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-bad">
                      <TrendingDown size={14} /> Needs work
                    </p>
                    <p className="font-display text-3xl font-semibold uppercase text-fg">
                      {weakestMap.map.name}
                    </p>
                    <p className="text-xs text-muted">
                      {weakestMap.kd.toFixed(2)} K/D · {num(weakestMap.avgDamage)} avg damage ·{' '}
                      {weakestMap.matches} matches
                    </p>
                  </div>
                )}
              </div>
            )}

            <DataTable
              columns={mapColumns}
              rows={byMap}
              initialSort={{ key: 'kd', dir: 'desc' }}
              pageSize={0}
              rowKey={(r) => r.map.id}
              dense
            />

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <BarCompare
                title="Average kills per map"
                data={byMap.map((r) => ({ name: r.map.name, value: r.avgFinishes }))}
                dataKey="value"
                label="Avg kills"
                decimals={2}
                height={220}
              />
              <BarCompare
                title="Average damage per map"
                data={byMap.map((r) => ({ name: r.map.name, value: r.avgDamage }))}
                dataKey="value"
                label="Avg damage"
                color={SERIES[1]}
                height={220}
              />
            </div>
          </Card>

          {/* ------------------------------------ match type breakdown --- */}
          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Scrims vs Tournaments vs Practice" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {byType.map((row) => (
                  <div key={row.type} className="rounded-xl border border-line bg-ink/50 p-3">
                    <p
                      className="font-head text-sm font-semibold"
                      style={{ color: MATCH_TYPES[row.type].color }}
                    >
                      {row.label}
                    </p>
                    <p className="num text-2xl text-fg">{row.kd.toFixed(2)}</p>
                    <p className="label">K/D</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <MiniStat label="Matches" value={row.matches} />
                      <MiniStat label="Avg dmg" value={num(row.avgDamage)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Personal records */}
            <Card>
              <CardHeader title="Personal records" icon={Medal} />
              <div className="space-y-2">
                {[
                  { label: 'Most kills in a match', row: records.kills, key: 'finishes', unit: '' },
                  { label: 'Highest damage', row: records.damage, key: 'damage', unit: '' },
                  { label: 'Longest kill', row: records.longest, key: 'longest_kill', unit: ' m' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-line bg-ink/50 px-3 py-2"
                  >
                    <div>
                      <p className="label">{item.label}</p>
                      {item.row && (
                        <Link
                          to={`/matches/${item.row.match_id}`}
                          className="text-[11px] text-muted hover:text-accent"
                        >
                          View that match →
                        </Link>
                      )}
                    </div>
                    <p className="num text-2xl text-accent">
                      {item.row ? num(item.row[item.key]) + item.unit : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ------------------------------------------ setup & socials --- */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader title="Device & settings" icon={Smartphone} />
              <div className="divide-y divide-line">
                <InfoRow label="Device" value={player.device || '—'} />
                <InfoRow label="FPS" value={player.fps_setting || '—'} />
                <InfoRow label="Gyro" value={player.gyro ? 'On' : 'Off'} />
                <InfoRow label="Preferred AR" value={player.preferred_ar || '—'} />
                <InfoRow label="Preferred DMR / SR" value={player.preferred_dmr || '—'} />
              </div>
              {player.sensitivity_notes && (
                <>
                  <p className="label mt-3 mb-1">Sensitivity</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-2.5 text-sm text-muted">
                    {player.sensitivity_notes}
                  </p>
                </>
              )}
            </Card>

            <Card>
              <CardHeader title="Socials" />
              {player.socials && Object.values(player.socials).some(Boolean) ? (
                <div className="flex flex-wrap gap-2">
                  {player.socials.instagram && (
                    <a
                      href={`https://instagram.com/${player.socials.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg"
                    >
                      <AtSign size={15} /> {player.socials.instagram}
                    </a>
                  )}
                  {player.socials.youtube && (
                    <a
                      href={`https://youtube.com/${player.socials.youtube}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg"
                    >
                      <Video size={15} /> {player.socials.youtube}
                    </a>
                  )}
                  {player.socials.x && (
                    <a
                      href={`https://x.com/${player.socials.x.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg"
                    >
                      <span className="font-bold">𝕏</span> {player.socials.x}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-faint">No social links added yet.</p>
              )}

              <p className="label mt-4 mb-1">Average finish</p>
              <p className="text-sm text-muted">
                {player.ign} finishes {ordinal(Math.round(derived.avgPlacement))} on average
                across {derived.matches} matches.
              </p>
            </Card>
          </div>

          {/* ----------------------------------------- match history --- */}
          <Card>
            <CardHeader
              title="Match history"
              subtitle={`${history.length} matches`}
              action={
                <Tabs
                  tabs={[
                    { value: 'all', label: 'All maps' },
                    ...byMap.map((r) => ({ value: r.map.id, label: r.map.name })),
                  ]}
                  value={mapFilter}
                  onChange={setMapFilter}
                />
              }
            />
            <DataTable
              columns={historyColumns}
              rows={history}
              initialSort={{ key: 'date', dir: 'desc' }}
              pageSize={15}
              rowKey={(r) => r.id}
              dense
            />
          </Card>
        </>
      )}

      {editing && <PlayerForm open player={player} onClose={() => setEditing(false)} />}
    </>
  )
}
