import { useEffect, useRef, useState } from 'react'

/** Delay between each pipeline panel fade-in (ms). */
export const STAGE_REVEAL_STAGGER_MS = 2000

export function useStaggeredStageReveal(
  analysisId: string | null,
  maxReadyIndex: number,
) {
  const [revealedThrough, setRevealedThrough] = useState(-1)
  const revealedRef = useRef(-1)

  useEffect(() => {
    revealedRef.current = -1
    setRevealedThrough(-1)
  }, [analysisId])

  useEffect(() => {
    if (!analysisId || maxReadyIndex < 0) return
    if (revealedRef.current >= maxReadyIndex) return

    let cancelled = false
    const target = maxReadyIndex

    const run = async () => {
      while (!cancelled && revealedRef.current < target) {
        const waitMs = revealedRef.current < 0 ? 0 : STAGE_REVEAL_STAGGER_MS
        await new Promise((r) => window.setTimeout(r, waitMs))
        if (cancelled) break
        const next = revealedRef.current + 1
        revealedRef.current = next
        setRevealedThrough(next)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [analysisId, maxReadyIndex])

  return revealedThrough
}
