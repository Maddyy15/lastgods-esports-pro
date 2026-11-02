/**
 * Small coloured labels: in-game role badges, roster status, match type,
 * placement chips and the "last 10 results" form strip.
 */
import { Link } from 'react-router-dom'
import {
  GAME_ROLES,
  PLAYER_STATUS,
  MATCH_TYPES,
  APP_ROLES,
  TOURNAMENT_STATUS,
  EVENT_TYPES,
  ATTENDANCE_STATUS,
  placementColor,
} from '@/lib/constants'
import { Badge } from './Primitives'
import { cx, ordinal, dateShort } from '@/lib/format'

/** IGL / Assaulter / Support / Sniper / Filler */
export function RoleBadge({ role, size = 'md', showFull = false }) {
  if (!role) return null
  const meta = GAME_ROLES[role]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {showFull ? meta.full : meta.label}
    </Badge>
  )
}

/** Both role badges together, the secondary one dimmed. */
export function RoleBadges({ primary, secondary, size = 'md' }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <RoleBadge role={primary} size={size} />
      {secondary && (
        <span className="opacity-60">
          <RoleBadge role={secondary} size={size} />
        </span>
      )}
    </span>
  )
}

export function StatusBadge({ status, size = 'md' }) {
  const meta = PLAYER_STATUS[status]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

export function MatchTypeBadge({ type, size = 'md' }) {
  const meta = MATCH_TYPES[type]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

export function AppRoleBadge({ role, size = 'md' }) {
  const meta = APP_ROLES[role]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

export function TournamentStatusBadge({ status, size = 'md' }) {
  const meta = TOURNAMENT_STATUS[status]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

export function EventTypeBadge({ type, size = 'md' }) {
  const meta = EVENT_TYPES[type]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

export function AttendanceBadge({ status, size = 'md' }) {
  const meta = ATTENDANCE_STATUS[status]
  if (!meta) return null
  return (
    <Badge color={meta.color} size={size}>
      {meta.label}
    </Badge>
  )
}

/* ---------------------------------------------------------------------------
 * PLACEMENT CHIP — one square showing where we finished
 * ------------------------------------------------------------------------- */
export function PlacementChip({ placement, size = 'md', title }) {
  const color = placementColor(placement)
  const sizes = {
    sm: 'h-6 w-6 text-[11px]',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  }
  return (
    <span
      title={title || `Finished ${ordinal(placement)}`}
      className={cx(
        'inline-flex items-center justify-center rounded-md border font-head font-bold tabular-nums',
        sizes[size],
      )}
      style={{
        color,
        borderColor: `${color}66`,
        backgroundColor: `${color}1f`,
        boxShadow: placement === 1 ? `0 0 14px -4px ${color}` : undefined,
      }}
    >
      {placement === 1 ? '🏆' : placement}
    </span>
  )
}

/**
 * The run of recent results. Newest on the left.
 * `items` comes from formStrip() / playerFormStrip() in src/lib/stats.js
 */
export function FormStrip({ items = [], size = 'md', linkMatches = true }) {
  if (!items.length) {
    return <span className="text-xs text-faint">No matches yet</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        const chip = (
          <PlacementChip
            placement={item.placement}
            size={size}
            title={`${ordinal(item.placement)} · ${dateShort(item.date)}`}
          />
        )
        return linkMatches ? (
          <Link key={item.id} to={`/matches/${item.id}`} className="focus-accent rounded-md">
            {chip}
          </Link>
        ) : (
          <span key={item.id}>{chip}</span>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * RANK MEDAL — gold / silver / bronze for the top three on the leaderboard
 * ------------------------------------------------------------------------- */
const MEDALS = {
  1: { color: '#f5c518', label: '1' },
  2: { color: '#c7ccd6', label: '2' },
  3: { color: '#cd7f32', label: '3' },
}

export function RankMedal({ rank, size = 'md' }) {
  const medal = MEDALS[rank]
  const sizes = { sm: 'h-6 w-6 text-xs', md: 'h-9 w-9 text-base', lg: 'h-12 w-12 text-xl' }

  if (!medal) {
    return (
      <span
        className={cx(
          'inline-flex items-center justify-center rounded-full border border-line',
          'font-head font-bold tabular-nums text-muted',
          sizes[size],
        )}
      >
        {rank}
      </span>
    )
  }

  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full border-2 font-head font-bold tabular-nums',
        sizes[size],
      )}
      style={{
        color: medal.color,
        borderColor: medal.color,
        backgroundColor: `${medal.color}1f`,
        boxShadow: `0 0 16px -4px ${medal.color}`,
      }}
    >
      {medal.label}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * TREND ARROW — shows whether a number moved up or down
 * ------------------------------------------------------------------------- */
export function Trend({ value, invert = false, suffix = '' }) {
  const n = Number(value) || 0
  if (Math.abs(n) < 0.05) return <span className="text-xs text-faint">—</span>
  const good = invert ? n < 0 : n > 0
  return (
    <span className={cx('text-xs font-semibold', good ? 'text-win' : 'text-bad')}>
      {n > 0 ? '▲' : '▼'} {Math.abs(n).toFixed(1)}
      {suffix}
    </span>
  )
}
