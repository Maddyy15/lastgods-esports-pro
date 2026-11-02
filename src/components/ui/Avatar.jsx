/**
 * Player / team avatar. Falls back to the initials on a coloured tile when
 * there is no photo, so a card never looks broken.
 */
import { useState } from 'react'
import { cx, initials } from '@/lib/format'
import { GAME_ROLES } from '@/lib/constants'

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 text-3xl',
}

export function Avatar({ src, name, size = 'md', role, className, square = false }) {
  const [failed, setFailed] = useState(false)
  const ring = role ? GAME_ROLES[role]?.color : 'var(--color-accent)'
  const showImage = src && !failed

  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden border-2 bg-card-hi',
        square ? 'rounded-xl' : 'rounded-full',
        SIZES[size],
        className,
      )}
      style={{ borderColor: `${ring}66` }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || ''}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-head font-bold"
          style={{ color: ring, backgroundColor: `${ring}18` }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  )
}

/** The team logo in the sidebar and dashboard header. */
export function TeamLogo({ src, name, size = 'md', className }) {
  return <Avatar src={src} name={name} size={size} square className={className} />
}
