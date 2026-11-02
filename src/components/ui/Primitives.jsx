/**
 * The small building blocks used on every page: buttons, cards, badges,
 * loading skeletons and empty states.
 */
import { cx } from '@/lib/format'

/* ---------------------------------------------------------------------------
 * BUTTON
 * ------------------------------------------------------------------------- */
const BUTTON_VARIANTS = {
  primary:
    'bg-accent text-black hover:brightness-110 shadow-[0_0_20px_-6px_var(--color-accent)]',
  secondary: 'bg-card-hi text-fg border border-line hover:border-accent/60 hover:bg-card',
  ghost: 'text-muted hover:text-fg hover:bg-card-hi',
  danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  outline: 'border border-accent/50 text-accent hover:bg-accent/10',
}

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center rounded-lg font-semibold transition-all focus-accent',
        'disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------------------
 * CARD
 * ------------------------------------------------------------------------- */
export function Card({ className, children, hover = false, glow = false, ...props }) {
  return (
    <div
      className={cx(
        'card-base p-4 sm:p-5 transition-all',
        hover && 'hover:border-accent/40 hover:bg-card-hi',
        glow && 'shadow-[0_0_40px_-20px_var(--color-accent)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Card heading with an optional action on the right. */
export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cx('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-base font-semibold text-fg sm:text-lg">
          {Icon && <Icon size={18} className="shrink-0 text-accent" />}
          <span className="truncate">{title}</span>
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Page-level heading used at the top of every route. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-fg sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * BADGE / PILL
 * ------------------------------------------------------------------------- */
export function Badge({ children, color = '#8d95a6', className, size = 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        className,
      )}
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}1a`,
      }}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * SPINNER + SKELETON
 * ------------------------------------------------------------------------- */
export function Spinner({ size = 18, className }) {
  return (
    <span
      className={cx('inline-block animate-spin rounded-full border-2', className)}
      style={{
        width: size,
        height: size,
        borderColor: 'currentColor',
        borderTopColor: 'transparent',
      }}
      aria-hidden
    />
  )
}

export function Skeleton({ className, style }) {
  return <div className={cx('skeleton', className)} style={style} aria-hidden />
}

/** A card-shaped placeholder shown while data loads. */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card-base space-y-3 p-5">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 4, className }) {
  return (
    <div className={cx('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * EMPTY STATE
 * ------------------------------------------------------------------------- */
export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 rounded-xl bg-accent/10 p-3 text-accent">
          <Icon size={26} />
        </div>
      )}
      <p className="font-head text-lg font-semibold text-fg">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * TOGGLE SWITCH
 * ------------------------------------------------------------------------- */
export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label
      className={cx(
        'flex items-center justify-between gap-4',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-accent',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  )
}

/* ---------------------------------------------------------------------------
 * TABS
 * ------------------------------------------------------------------------- */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div
      className={cx(
        'flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1',
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-accent',
            value === tab.value
              ? 'bg-accent text-black'
              : 'text-muted hover:bg-card-hi hover:text-fg',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 opacity-70">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * PROGRESS BAR — used by ratings, milestones and comparisons
 * ------------------------------------------------------------------------- */
export function ProgressBar({ value, max = 100, color, className, height = 6 }) {
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / max) * 100))
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-line', className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color || 'var(--color-accent)' }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * ALERT
 * ------------------------------------------------------------------------- */
export function Alert({ tone = 'info', title, children, className }) {
  const tones = {
    info: { color: '#38bdf8' },
    warn: { color: '#eab308' },
    error: { color: '#ef4444' },
    success: { color: '#22c55e' },
  }
  const { color } = tones[tone] || tones.info
  return (
    <div
      className={cx('rounded-xl border p-3 text-sm', className)}
      style={{ borderColor: `${color}44`, backgroundColor: `${color}12` }}
    >
      {title && (
        <p className="font-semibold" style={{ color }}>
          {title}
        </p>
      )}
      <div className="text-muted">{children}</div>
    </div>
  )
}
