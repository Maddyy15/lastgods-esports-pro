/**
 * Modal dialogs and the confirm-before-delete dialog.
 *
 * On a phone the modal slides up from the bottom and can be scrolled; on a
 * laptop it is centred. Escape closes it, and clicking the dark backdrop
 * closes it too.
 */
import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from './Primitives'
import { cx } from '@/lib/format'

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-[95vw]',
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
}) {
  // Close on Escape, and stop the page behind from scrolling
  const onKey = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onKey])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Panel */}
      <div
        className={cx(
          'relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line',
          'bg-card shadow-2xl sm:rounded-2xl animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-head text-lg font-semibold text-fg sm:text-xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hi hover:text-fg focus-accent"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-4 sm:p-5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------------------
 * CONFIRM DIALOG — shown before anything is deleted
 * ------------------------------------------------------------------------- */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  busy = false,
  tone = 'danger',
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="shrink-0 rounded-lg bg-bad/15 p-2 text-bad">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {message || 'This cannot be undone.'}
        </p>
      </div>
    </Modal>
  )
}

/**
 * Hook that makes "confirm then delete" a two-liner in any page:
 *
 *   const confirm = useConfirm()
 *   ...
 *   confirm.ask({ message: 'Delete match #12?', onConfirm: () => remove(id) })
 *   ...
 *   <confirm.Dialog />
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false })
  const [busy, setBusy] = useState(false)

  const ask = (options) => setState({ open: true, ...options })
  const close = () => setState({ open: false })

  const run = async () => {
    if (!state.onConfirm) return close()
    setBusy(true)
    try {
      await state.onConfirm()
      close()
    } finally {
      setBusy(false)
    }
  }

  const Dialog = () => (
    <ConfirmDialog
      open={state.open}
      busy={busy}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      onCancel={close}
      onConfirm={run}
    />
  )

  return { ask, Dialog }
}
