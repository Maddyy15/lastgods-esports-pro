/**
 * A sortable, paginated table used by Matches, Leaderboard, map breakdowns
 * and the activity log.
 *
 * Columns look like this:
 *   {
 *     key: 'damage',                  // unique id
 *     label: 'Damage',
 *     align: 'right',                 // left | center | right  (default left)
 *     sortable: true,                 // default true
 *     value: (row) => row.damage,     // what to SORT by
 *     render: (row) => <b>...</b>,    // what to SHOW (defaults to value)
 *     hideOnMobile: true,             // keeps phone tables readable
 *   }
 *
 * On a phone the table scrolls sideways and the first column stays pinned.
 */
import { useMemo, useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cx } from '@/lib/format'
import { Button } from './Primitives'

export function DataTable({
  columns,
  rows,
  initialSort,
  pageSize = 20,
  onRowClick,
  rowKey = (row, i) => row.id ?? i,
  empty = null,
  dense = false,
  stickyFirst = true,
  className,
}) {
  const [sort, setSort] = useState(initialSort || null)
  const [page, setPage] = useState(0)

  // Jump back to page 1 whenever the data or the sort changes
  useEffect(() => setPage(0), [rows.length, sort?.key, sort?.dir])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.value || ((row) => row[col.key])

    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)

      // Nulls always sink to the bottom
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1

      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true })

      return sort.dir === 'asc' ? result : -result
    })
  }, [rows, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = pageSize ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted

  const toggleSort = (col) => {
    if (col.sortable === false) return
    setSort((current) => {
      if (current?.key !== col.key) return { key: col.key, dir: 'desc' }
      if (current.dir === 'desc') return { key: col.key, dir: 'asc' }
      return null // third click clears the sort
    })
  }

  const alignClass = (align) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  if (!rows.length && empty) return empty

  return (
    <div className={cx('w-full', className)}>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((col, i) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col)}
                    className={cx(
                      'label whitespace-nowrap border-b border-line px-3 py-2.5',
                      alignClass(col.align),
                      col.sortable !== false && 'cursor-pointer select-none hover:text-fg',
                      active && 'text-accent',
                      col.hideOnMobile && 'hidden md:table-cell',
                      stickyFirst && i === 0 && 'sticky left-0 z-10 bg-surface',
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    <span
                      className={cx(
                        'inline-flex items-center gap-1',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.label}
                      {col.sortable !== false &&
                        (active ? (
                          sort.dir === 'asc' ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={11} className="opacity-30" />
                        ))}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-line/60 transition-colors last:border-0',
                  rowIndex % 2 === 1 && 'bg-ink/30',
                  onRowClick && 'cursor-pointer hover:bg-card-hi',
                )}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cx(
                      'whitespace-nowrap px-3 tabular-nums',
                      dense ? 'py-1.5' : 'py-2.5',
                      alignClass(col.align),
                      col.hideOnMobile && 'hidden md:table-cell',
                      stickyFirst &&
                        i === 0 &&
                        cx(
                          'sticky left-0 z-10',
                          rowIndex % 2 === 1 ? 'bg-[#0b0d11]' : 'bg-card',
                        ),
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row) : (col.value ? col.value(row) : row[col.key]) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}

            {!pageRows.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={14} /> Prev
            </Button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
