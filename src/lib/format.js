/**
 * Small formatting helpers used all over the UI.
 * Keeping them here means every number on every page looks the same.
 */
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

/** 12480 -> "12,480"   |   null -> "0" */
export function num(value, decimals = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** 12480 -> "12.5k"  — for tight stat boxes on phones */
export function compact(value) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

/** 0.6421 -> "64.2%" (pass a value already in 0-100 with isPercent = true) */
export function pct(value, decimals = 1, alreadyPercent = true) {
  const n = Number(value) || 0
  return `${(alreadyPercent ? n : n * 100).toFixed(decimals)}%`
}

/** 25000 -> "₹25,000" */
export function rupees(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/** 1265 seconds -> "21m 05s" */
export function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}m ${String(rest).padStart(2, '0')}s`
}

/** 1265 seconds -> "21.1" (minutes, for charts and tables) */
export function minutes(seconds, decimals = 1) {
  return ((Number(seconds) || 0) / 60).toFixed(decimals)
}

function toDate(value) {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

/** "12 Oct 2026" */
export function dateShort(value) {
  const d = toDate(value)
  return d ? format(d, 'd MMM yyyy') : '—'
}

/** "12 Oct, 8:40 PM" — the format used in the activity feed */
export function dateTime(value) {
  const d = toDate(value)
  return d ? format(d, 'd MMM, h:mm a') : '—'
}

/** "8:40 PM" */
export function timeOnly(value) {
  const d = toDate(value)
  return d ? format(d, 'h:mm a') : '—'
}

/** "2 hours ago" */
export function timeAgo(value) {
  const d = toDate(value)
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—'
}

/** For <input type="datetime-local"> which needs "2026-10-12T20:40" */
export function toLocalInput(value) {
  const d = toDate(value) || new Date()
  const pad = (x) => String(x).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/** "1st", "2nd", "3rd", "12th" */
export function ordinal(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const k = v % 100
  return v + (s[(k - 20) % 10] || s[k] || s[0])
}

/** Joins class names, skipping anything falsy. cx('a', cond && 'b') */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** Safe division — returns 0 instead of Infinity or NaN. */
export function safeDiv(a, b, decimals = 2) {
  const top = Number(a) || 0
  const bottom = Number(b) || 0
  if (bottom === 0) return 0
  return Number((top / bottom).toFixed(decimals))
}

/** "LG-SHADOW" -> "LS"  (used for the fallback avatar) */
export function initials(name) {
  if (!name) return '?'
  const clean = String(name).replace(/[^a-zA-Z0-9 -]/g, ' ')
  const parts = clean.split(/[\s-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Turns "grand_finals" into "Grand finals" for display. */
export function humanize(value) {
  if (!value) return '—'
  return String(value).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
