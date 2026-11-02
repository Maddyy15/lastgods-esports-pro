/**
 * Form controls. Every input in the app uses these so spacing, focus rings
 * and error messages look the same everywhere.
 */
import { useId } from 'react'
import { cx } from '@/lib/format'

const BASE =
  'w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg ' +
  'placeholder:text-faint transition-colors focus-accent ' +
  'focus:border-accent/60 disabled:opacity-50 disabled:cursor-not-allowed'

/* ---------------------------------------------------------------------------
 * FIELD — label + control + hint/error, used to wrap every input
 * ------------------------------------------------------------------------- */
export function Field({ label, hint, error, required, children, className }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && (
        <label className="label block">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * TEXT / NUMBER / DATE INPUTS
 * ------------------------------------------------------------------------- */
export function Input({ label, hint, error, required, className, wrapClass, ...props }) {
  const id = useId()
  const control = (
    <input id={id} className={cx(BASE, error && 'border-bad', className)} {...props} />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClass}>
      {control}
    </Field>
  )
}

export function Textarea({ label, hint, error, required, className, rows = 4, ...props }) {
  const control = (
    <textarea
      rows={rows}
      className={cx(BASE, 'resize-y leading-relaxed', error && 'border-bad', className)}
      {...props}
    />
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {control}
    </Field>
  )
}

/**
 * Select. `options` is [{ value, label }] — or plain strings, which are used
 * as both value and label.
 */
export function Select({
  label,
  hint,
  error,
  required,
  options = [],
  placeholder,
  className,
  ...props
}) {
  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  const control = (
    <select
      className={cx(BASE, 'cursor-pointer appearance-none pr-8', error && 'border-bad', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238d95a6' d='M6 8.5 1.5 4h9z'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
      }}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {normalised.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  if (!label && !hint && !error) return control
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {control}
    </Field>
  )
}

/* ---------------------------------------------------------------------------
 * CHECKBOX
 * ------------------------------------------------------------------------- */
export function Checkbox({ label, checked, onChange, hint, className, ...props }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5 select-none', className)}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent)] focus-accent"
        {...props}
      />
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </span>
    </label>
  )
}

/* ---------------------------------------------------------------------------
 * NUMBER INPUT — used in every stat form. Keeps an empty box empty instead of
 * forcing a 0, which makes fast typing much less annoying.
 * ------------------------------------------------------------------------- */
export function NumberInput({ value, onChange, min = 0, max, step = 1, className, ...props }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value === 0 || value ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? '' : Number(raw))
      }}
      onFocus={(e) => e.target.select()}
      className={cx(BASE, 'text-center font-head font-semibold tabular-nums', className)}
      {...props}
    />
  )
}

/* ---------------------------------------------------------------------------
 * COLOUR PICKER — Settings uses this for the team accent colour
 * ------------------------------------------------------------------------- */
export function ColorInput({ label, value, onChange, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#f59e0b'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-ink p-1"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#f59e0b"
          className={cx(BASE, 'font-mono uppercase')}
        />
      </div>
    </Field>
  )
}

/* ---------------------------------------------------------------------------
 * FILE PICKER — player photos, match screenshots, team logo
 * ------------------------------------------------------------------------- */
export function FileInput({ label, hint, onFile, accept = 'image/*', disabled }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className={cx(
          'w-full cursor-pointer rounded-lg border border-line bg-ink text-sm text-muted',
          'file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0',
          'file:bg-card-hi file:px-3 file:py-2 file:text-sm file:font-semibold file:text-fg',
          'hover:file:bg-accent hover:file:text-black focus-accent',
        )}
      />
    </Field>
  )
}

/* ---------------------------------------------------------------------------
 * FORM GRID + ACTIONS — the standard two-column modal form layout
 * ------------------------------------------------------------------------- */
export function FormGrid({ children, cols = 2, className }) {
  return (
    <div
      className={cx(
        'grid gap-4',
        cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : '',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function FormSection({ title, children, className }) {
  return (
    <section className={cx('space-y-4', className)}>
      <h4 className="label border-b border-line pb-2">{title}</h4>
      {children}
    </section>
  )
}
