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
  const showImage = src && !failed
  // A photo keeps its role-coloured ring. Initials always get the gold ring —
  // they are the brand stand-in when there is no picture, so they should look
  // deliberate rather than like a missing image.
  const ring = showImage && role ? GAME_ROLES[role]?.color : 'var(--color-accent)'

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

/**
 * The team logo in the sidebar, the top bar and on the login page.
 *
 * Falls back to the bundled Last Gods mark at /public/logo.png, so the brand
 * shows even before anyone uploads a logo in Settings. Uploading one there
 * still overrides this.
 */
export function TeamLogo({ src, name, size = 'md', className }) {
  return (
    <Avatar
      src={src || '/logo.png'}
      name={name}
      size={size}
      square
      className={className}
    />
  )
}
