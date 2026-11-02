/**
 * Export and import helpers used by the Settings page.
 * Everything runs in the browser — no server, no extra library.
 */

/** Escapes one cell so commas, quotes and newlines survive the round trip. */
function cell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') value = JSON.stringify(value)
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Turns an array of row objects into CSV text. */
export function toCSV(rows) {
  if (!rows || !rows.length) return ''
  // Use the union of all keys, so rows with missing fields still line up
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => cell(row[h])).join(','))
  }
  return lines.join('\n')
}

/** Triggers a browser download for any text content. */
export function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the browser a moment before releasing the object URL
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCSV(name, rows) {
  download(`${name}.csv`, toCSV(rows), 'text/csv;charset=utf-8')
}

export function downloadJSON(name, data) {
  download(`${name}.json`, JSON.stringify(data, null, 2), 'application/json')
}

/**
 * A small CSV reader that understands quoted fields.
 * Returns an array of objects keyed by the header row.
 */
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++ // an escaped quote inside a quoted field
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  // last field / row
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  if (!rows.length) return []
  const headers = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
}

/** The full backup file produced by "Export everything". */
export function buildBackup(data) {
  return {
    app: 'LastGods Esports',
    version: 1,
    exported_at: new Date().toISOString(),
    settings: data.settings,
    players: data.players,
    maps: data.maps,
    drop_spots: data.dropSpots,
    matches: data.matches,
    match_player_stats: data.matchStats,
    tournaments: data.tournaments,
    tournament_standings: data.standings,
    opponents: data.opponents,
    opponent_spots: data.opponentSpots,
    schedule_events: data.events,
    attendance: data.attendance,
    strategy_notes: data.notes,
    announcements: data.announcements,
  }
}

/** Which tables the Settings page offers as individual CSV downloads. */
export const EXPORTABLE_TABLES = [
  { key: 'players', label: 'Players' },
  { key: 'matches', label: 'Matches' },
  { key: 'matchStats', label: 'Match player stats' },
  { key: 'maps', label: 'Maps' },
  { key: 'dropSpots', label: 'Drop spots' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'standings', label: 'Tournament standings' },
  { key: 'opponents', label: 'Opponents' },
  { key: 'events', label: 'Schedule' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'notes', label: 'Strategy notes' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'activity', label: 'Activity log' },
]
