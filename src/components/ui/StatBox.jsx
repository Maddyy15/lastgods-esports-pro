/**
 * Stat boxes — the number-and-label tiles used on the dashboard and profiles.
 *
 * The number and its label always live inside the SAME box and share one
 * alignment, so a row of tiles never looks ragged no matter how long the
 * numbers get.
 */
import { useEffect, useRef, useState } from 'react'
import { cx, num } from '@/lib/format'

/* ---------------------------------------------------------------------------
 * COUNT-UP — animates a number from 0 to its value when it first appears
 * ------------------------------------------------------------------------- */
export function CountUp({ value, decimals = 0, duration = 900, suffix = '', prefix = '' }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(target)
  const frame = useRef()
  const previous = useRef(0)

  useEffect(() => {
    // Respect the "reduce motion" setting
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target)
      return
    }

    const from = previous.current
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      // ease-out cubic, so it slows down at the end
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(from + (target - from) * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
      else previous.current = target
    }

    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])

  return (
    <>
      {prefix}
      {num(shown, decimals)}
      {suffix}
    </>
  )
}

/* ---------------------------------------------------------------------------
 * STAT BOX
 * ------------------------------------------------------------------------- */
export function StatBox({
  label,
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  hint,
  icon: Icon,
  color,
  animate = true,
  size = 'md',
  className,
  onClick,
}) {
  const sizes = {
    sm: 'text-2xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-4xl sm:text-5xl',
  }

  const isNumber = typeof value === 'number'

  return (
    <div
      onClick={onClick}
      className={cx(
        'card-base flex flex-col justify-between gap-2 p-3 sm:p-4',
        'animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)_both]',
        onClick && 'cursor-pointer transition-colors hover:border-accent/40 hover:bg-card-hi',
        className,
      )}
    >
      {/* Top row: label on the left, optional icon on the right */}
      <div className="flex items-start justify-between gap-2">
        <span className="label leading-tight">{label}</span>
        {Icon && (
          <Icon size={15} className="shrink-0 opacity-70" style={{ color: color || 'var(--color-accent)' }} />
        )}
      </div>

      {/* The number */}
      <div
        className={cx('num tabular-nums', sizes[size])}
        style={{ color: color || 'var(--color-fg)' }}
      >
        {isNumber && animate ? (
          <CountUp value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
        ) : (
          <>
            {prefix}
            {isNumber ? num(value, decimals) : (value ?? '—')}
            {suffix}
          </>
        )}
      </div>

      {hint && <p className="text-[11px] leading-tight text-faint">{hint}</p>}
    </div>
  )
}

/** A responsive grid of stat boxes. */
export function StatGrid({ children, cols = 4, className }) {
  const map = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }
  return <div className={cx('grid gap-2.5 sm:gap-3', map[cols], className)}>{children}</div>
}

/* ---------------------------------------------------------------------------
 * MINI STAT — a compact label/value pair for dense lists and detail panels
 * ------------------------------------------------------------------------- */
export function MiniStat({ label, value, color, className }) {
  return (
    <div className={cx('rounded-lg border border-line bg-ink/60 px-2.5 py-2', className)}>
      <p className="label text-[9px] leading-tight">{label}</p>
      <p
        className="num mt-0.5 text-lg tabular-nums"
        style={{ color: color || 'var(--color-fg)' }}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

/** A label and value on one line — used inside info panels. */
export function InfoRow({ label, value, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-1.5', className)}>
      <span className="label shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-fg">{value ?? '—'}</span>
    </div>
  )
}
