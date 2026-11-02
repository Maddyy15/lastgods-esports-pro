/**
 * The editor for a player's CARRIED-OVER stats — the numbers from before the
 * team started logging matches in this app.
 *
 * The one idea to hold on to: nothing here is calculated. These are numbers
 * you type, and the app adds them on top of the real logged matches:
 *
 *      Manual 20 kills  +  Logged 35 kills  =  Total 55 kills
 *
 * Every field shows that sum live as you type, so you can always see how the
 * final number on the Roster or Leaderboard is being made.
 */
import { num, cx } from '@/lib/format'
import { Input } from '@/components/ui/Form'

/* ---------------------------------------------------------------------------
 * mm:ss <-> seconds
 * ---------------------------------------------------------------------------
 * Survival is typed the way the game shows it ("14:30"), but stored as plain
 * seconds so it can be averaged and summed.
 * ------------------------------------------------------------------------- */
export function parseMmSs(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return 0
  if (!raw.includes(':')) return Math.max(0, Math.round(Number(raw) || 0))
  const [m, s] = raw.split(':')
  const mins = Math.max(0, Math.floor(Number(m) || 0))
  const secs = Math.max(0, Math.floor(Number(s) || 0))
  return mins * 60 + Math.min(59, secs)
}

export function toMmSs(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Keeps a typed value a non-negative number. Blank stays blank while typing. */
function clean(value, decimal = false) {
  if (value === '' || value === null || value === undefined) return ''
  const n = decimal ? Number(value) : Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/* ---------------------------------------------------------------------------
 * ONE FIELD
 * ---------------------------------------------------------------------------
 * The number input plus the live "manual + logged = total" line underneath.
 * ------------------------------------------------------------------------- */
function StatField({ field, value, logged, onChange }) {
  const manualValue = Number(value) || 0
  const loggedValue = Number(logged) || 0

  // `longest_kill` is a record, not a running total, so the bigger of the two
  // wins rather than the two being added together.
  const total = field.record
    ? Math.max(manualValue, loggedValue)
    : manualValue + loggedValue
  const decimals = field.decimal ? 1 : 0

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <label className="label mb-1.5 block">{field.label}</label>
      <Input
        type="number"
        min={0}
        step={field.decimal ? '0.1' : '1'}
        inputMode={field.decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(e) => onChange(clean(e.target.value, field.decimal))}
        onBlur={(e) => onChange(clean(e.target.value, field.decimal) || 0)}
        placeholder="0"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
        <span className="text-accent">{num(manualValue, decimals)}</span> manual
        {field.record ? ' vs ' : ' + '}
        <span className="text-fg">{num(loggedValue, decimals)}</span> logged ={' '}
        <span className="font-semibold text-fg">{num(total, decimals)}</span>
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * THE HEADLINE SUMMARY
 * ------------------------------------------------------------------------- */
function SummaryLine({ label, manual, logged, suffix }) {
  return (
    <p className="text-xs text-muted">
      <span className="text-faint">{label}:</span>{' '}
      <span className="text-accent">{num(manual)}</span> manual +{' '}
      <span className="text-fg">{num(logged)}</span> logged ={' '}
      <span className="font-head text-sm font-semibold text-fg">
        {num(manual + logged)}
      </span>{' '}
      <span className="text-faint">{suffix}</span>
    </p>
  )
}

/* ---------------------------------------------------------------------------
 * THE GRID OF FIELDS
 * ---------------------------------------------------------------------------
 * @param fields   which fields to show (MANUAL_OVERALL_FIELDS or MANUAL_MAP_FIELDS)
 * @param values   the manual row being edited
 * @param logged   that player's LOGGED totals for the same scope, for comparison
 * @param onChange (key, value) => void
 * @param survival true to include the mm:ss average survival field
 * ------------------------------------------------------------------------- */
export function ManualStatsFields({
  fields,
  values,
  logged,
  onChange,
  survival = false,
  className,
}) {
  const summaryKeys = fields
    .filter((f) => ['matches', 'finishes', 'damage', 'wwcd'].includes(f.key))
    .map((f) => f)

  return (
    <div className={cx('space-y-4', className)}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <StatField
            key={field.key}
            field={field}
            value={values[field.key] ?? 0}
            logged={logged?.[field.key] ?? 0}
            onChange={(v) => onChange(field.key, v)}
          />
        ))}

        {survival && (
          <div className="rounded-xl border border-line bg-card p-3">
            <label className="label mb-1.5 block">Avg survival (mm:ss)</label>
            <Input
              value={values.avg_survival_text ?? toMmSs(values.avg_survival_seconds)}
              onChange={(e) => onChange('avg_survival_text', e.target.value)}
              onBlur={(e) => {
                const seconds = parseMmSs(e.target.value)
                onChange('avg_survival_seconds', seconds)
                onChange('avg_survival_text', toMmSs(seconds))
              }}
              placeholder="14:30"
              inputMode="numeric"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
              Average per match. Logged average:{' '}
              <span className="text-fg">{toMmSs(logged?.avgSurvival ?? 0)}</span>
            </p>
          </div>
        )}
      </div>

      {/* The spelled-out version of the main numbers, as a sanity check. */}
      <div className="space-y-1 rounded-xl border border-line bg-surface p-3">
        {summaryKeys.map((field) => (
          <SummaryLine
            key={field.key}
            label={field.label}
            manual={Number(values[field.key]) || 0}
            logged={Number(logged?.[field.key]) || 0}
            suffix={field.key === 'matches' ? 'matches' : field.label.toLowerCase()}
          />
        ))}
      </div>
    </div>
  )
}
