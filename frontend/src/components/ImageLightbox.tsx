import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ImageLightboxProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function ImageLightbox({
  open,
  onClose,
  title,
  children,
  footer,
}: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="glass-card flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden shadow-[0_0_80px_-20px_rgba(168,85,247,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-purple-500/30 bg-violet-950/50 px-4 py-3 sm:px-5">
          <div>
            <p className="font-display text-lg font-bold text-fuchsia-100 sm:text-xl">
              {title}
            </p>
            <p className="mt-0.5 text-xs text-violet-400/90">
              Esc or click outside to close
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-purple-500/40 bg-purple-950/60 px-3 py-1.5 text-sm font-semibold text-violet-100 transition hover:border-fuchsia-400/50 hover:bg-purple-900/70"
            aria-label="Close enlarged view"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">{children}</div>
        {footer ? (
          <div className="border-t border-purple-500/25 bg-violet-950/40 px-4 py-3 text-sm text-violet-200/90 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
