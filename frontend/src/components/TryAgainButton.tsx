import { useAnalysis } from '../context/AnalysisContext'

type NewPhotoButtonProps = {
  onGoToStart: () => void
  className?: string
}

/** Clears the run and returns to Start to pick a different image. */
export function NewPhotoButton({ onGoToStart, className = '' }: NewPhotoButtonProps) {
  const { reset, analysisId } = useAnalysis()

  if (!analysisId) return null

  return (
    <button
      type="button"
      onClick={() => {
        reset()
        onGoToStart()
      }}
      className={`rounded-xl border border-violet-400/50 bg-violet-950/60 px-4 py-2 text-sm font-bold text-violet-100 transition hover:border-fuchsia-400/55 hover:bg-violet-900/70 ${className}`}
    >
      New photo
    </button>
  )
}
